"""
Simulation orchestrator - manages large-scale agent simulations.

Uses async patterns inspired by AgentSociety:
- QwenLLM actor pool for distributed LLM calls (via HuggingFace Space Ollama API)
- asyncio.gather() for concurrent agent processing
- Agents are plain objects, not Ray actors
"""
import logging
import asyncio
import json
import os
from typing import List, Dict, Any, Optional

from simulation.ray_cluster import init_ray_cluster, shutdown_ray
from simulation.agents.social_agent import SocialAgent
from simulation.utils.profile_generator import ProfileGenerator
from simulation.llm_client import QwenLLM, shutdown_llm_pool

logger = logging.getLogger(__name__)


def _clean_env(name: str, default: str = "") -> str:
    """Read env var and trim surrounding whitespace/newlines."""
    return (os.getenv(name, default) or default).strip()


class SimulationOrchestrator:
    """
    Orchestrate large-scale agent simulations.

    Manages:
    - LLM actor pool (Ray-backed, Qwen via Ollama API)
    - Agent spawning (plain objects)
    - Ad content distribution
    - Result collection and analysis
    - Risk detection
    """

    def __init__(
        self,
        experiment_id: str,
        num_agents: int = 1000,
        mqtt_host: str = "localhost",
        mqtt_port: int = 1883,
        mqtt_transport: str = "tcp",
        mqtt_path: Optional[str] = None,
        chroma_host: str = "localhost",
        chroma_port: int = 8000,
        chroma_ssl: bool = False,
    ):
        self.experiment_id = experiment_id
        self.num_agents = num_agents
        self.chroma_host = chroma_host
        self.chroma_port = chroma_port
        self.chroma_ssl = chroma_ssl

        self.agents: List[SocialAgent] = []
        self.profiles = []
        self.social_network = {}
        self.event_logs = []
        self.llm_pool: Optional[QwenLLM] = None

    async def run(
        self,
        ad_content: str,
        demographic_filter: Optional[Dict[str, Any]] = None,
        simulation_days: int = 5,
        redis_client=None,
        custom_agent_profiles: Optional[List[Dict]] = None,
        use_custom_agents_only: bool = False,
    ) -> Dict[str, Any]:
        """
        Run full simulation (async).

        Args:
            ad_content: VLM-generated description of ad
            demographic_filter: Target demographics
            simulation_days: Days to simulate
            redis_client: Redis client for progress updates

        Returns:
            Simulation results with engagement score, sentiment, risk flags
        """
        logger.info(
            f"Starting simulation {self.experiment_id} "
            f"with {self.num_agents} agents"
        )

        try:
            # Initialize Ray cluster
            init_ray_cluster(num_cpus=None)

            # Create LLM actor pool (Qwen via Ollama API)
            num_actors = min(4, max(1, self.num_agents // 3))
            self.llm_pool = QwenLLM(num_actors=num_actors)
            logger.info(f"LLM actor pool created with {num_actors} actors")

            # Profiles and spawning agents
            self._update_progress(redis_client, 5, 0, 0)
            self._spawn_agents(custom_agent_profiles, use_custom_agents_only, demographic_filter)
            logger.info(f"Spawned {len(self.agents)} agents")

            # Have all agents perceive the ad
            self._update_progress(redis_client, 20, 1, len(self.agents))
            final_states = await self._run_simulation(
                ad_content, simulation_days, redis_client
            )

            # Analyze results
            results = self._analyze_results(final_states)

            # Cleanup
            self._cleanup()

            logger.info(
                f"Simulation complete. "
                f"Engagement score: {results['engagement_score']:.1f}"
            )

            return results

        except Exception as e:
            logger.error(f"Simulation failed: {e}")
            self._cleanup()
            raise

    def _spawn_agents(
        self, 
        custom_agent_profiles: Optional[List[Dict]] = None, 
        use_custom_agents_only: bool = False,
        demographic_filter: Optional[Dict[str, Any]] = None
    ):
        """Spawn all agents as plain Python objects and configure network"""
        self.agents = []

        if use_custom_agents_only:
            # Only use the explicitly provided custom profiles — no AI padding
            if custom_agent_profiles:
                self.profiles = list(custom_agent_profiles)
            else:
                logger.warning(
                    "use_custom_agents_only=True but no custom profiles were provided. "
                    "Simulation will run with 0 agents."
                )
                self.profiles = []
        elif custom_agent_profiles:
            self.profiles = list(custom_agent_profiles)
            remaining = self.num_agents - len(self.profiles)
            if remaining > 0:
                self.profiles.extend(ProfileGenerator.generate_profiles(remaining, demographic_filter))
            self.profiles = self.profiles[:self.num_agents]
        else:
            self.profiles = ProfileGenerator.generate_profiles(self.num_agents, demographic_filter)
            
        self.social_network = ProfileGenerator.generate_social_network(
            self.profiles, avg_friends=8
        )

        # Try to create a shared memory store (optional)
        memory_store = self._create_memory_store()

        for profile in self.profiles:
            agent_id = profile["agent_id"]
            friends = self.social_network.get(agent_id, [])

            agent = SocialAgent(
                agent_id=agent_id,
                profile=profile,
                experiment_id=self.experiment_id,
                llm_pool=self.llm_pool,
                friends=friends,
                memory_store=memory_store,
            )

            self.agents.append(agent)

    def _create_memory_store(self):
        """Try to create a shared ChromaDB memory store (optional)"""
        try:
            from simulation.agents.agent_memory import AgentMemoryStore

            return AgentMemoryStore(
                chroma_host=self.chroma_host,
                chroma_port=self.chroma_port,
                collection_name=f"exp_{self.experiment_id}",
                ssl=self.chroma_ssl,
            )
        except Exception as e:
            logger.info(
                f"ChromaDB not available, running without memory: {e}"
            )
            return None

    async def _run_simulation(
        self,
        ad_content: str,
        simulation_days: int,
        redis_client=None,
    ) -> List[Dict[str, Any]]:
        """
        Run the actual simulation using asyncio.gather().

        Each agent perceives the ad via async calls to the LLM actor pool.
        Rate limiting is applied between batches.
        """
        logger.info("Broadcasting ad content to all agents...")

        # Qwen HF Space has no per-minute rate limits, but responses are slow
        # (~30-60s per request on free CPU). Using batch_size=3 with 2s delay.
        batch_size = 3
        batch_delay = 2
        all_states = []

        total_batches = (len(self.agents) + batch_size - 1) // batch_size
        logger.info(
            f"Processing {len(self.agents)} agents in {total_batches} "
            f"batches (Qwen via Ollama API)"
        )

        for i in range(0, len(self.agents), batch_size):
            batch = self.agents[i : i + batch_size]
            batch_num = (i // batch_size) + 1

            # Check for cancellation
            if redis_client:
                try:
                    if redis_client.get(f"sim:{self.experiment_id}:cancel"):
                        logger.warning(f"Simulation {self.experiment_id} was cancelled by user.")
                        raise Exception("Cancelled by user")
                except Exception as e:
                    if str(e) == "Cancelled by user":
                        raise e
                    logger.debug(f"Redis check failed: {e}")

            logger.info(
                f"Batch {batch_num}/{total_batches}: "
                f"Processing {len(batch)} agents..."
            )

            # Use asyncio.gather for concurrent processing within batch
            tasks = [agent.perceive_ad(ad_content) for agent in batch]
            batch_states = await asyncio.gather(*tasks, return_exceptions=True)

            # Collect results, handle any exceptions
            for j, state in enumerate(batch_states):
                if isinstance(state, Exception):
                    logger.error(
                        f"Agent {batch[j].agent_id} failed: {state}"
                    )
                    all_states.append(batch[j].get_state())
                else:
                    all_states.append(state)
                    logger.info(
                        f"  ✓ {state.get('agent_id','?')}: "
                        f"{state.get('emotion','?')} / {state.get('opinion_on_ad','?')} "
                        f"— {state.get('reasoning','')[:80]}"
                    )

            # Update progress
            progress = 20 + int(
                (i + len(batch)) / len(self.agents) * 60
            )
            agents_per_day = max(
                1, len(self.agents) // max(1, simulation_days)
            )
            current_day = min(
                (i // agents_per_day) + 1, simulation_days
            )
            self._update_progress(
                redis_client, progress, current_day, len(all_states)
            )

            logger.info(
                f"Processed {len(all_states)}/{len(self.agents)} agents"
            )

            # Rate limiting delay between batches
            if i + batch_size < len(self.agents):
                logger.info(f"Rate limit pause: {batch_delay}s...")
                await asyncio.sleep(batch_delay)

        agents_by_id = {a.agent_id: a for a in self.agents}

        # Simulate social influence over days
        for day in range(2, simulation_days + 1):
            if redis_client:
                try:
                    if redis_client.get(f"sim:{self.experiment_id}:cancel"):
                        logger.warning(f"Simulation {self.experiment_id} was cancelled by user.")
                        raise Exception("Cancelled by user")
                except Exception as e:
                    if str(e) == "Cancelled by user":
                        raise e
                    logger.debug(f"Redis check failed: {e}")
                    
            logger.info(f"Day {day} Social Loop - Messaging Phase")
            for agent in self.agents:
                if agent.has_seen_ad and agent.opinion_on_ad is not None:
                    message = await agent.generate_social_message()
                    for friend_id in agent.friends:
                        friend = agents_by_id.get(friend_id)
                        if friend:
                            friend.receive_peer_message(agent.agent_id, agent.opinion_on_ad, message)

            logger.info(f"Day {day} Social Loop - Deliberation Phase")
            deliberation_tasks = [agent.social_deliberation(ad_content) for agent in self.agents]
            await asyncio.gather(*deliberation_tasks, return_exceptions=True)

            if redis_client:
                try:
                    redis_client.setex(
                        f"sim:{self.experiment_id}:status",
                        300,
                        json.dumps({
                            "progress": int((day / simulation_days) * 100),
                            "current_day": day,
                            "active_agents": len(self.agents)
                        })
                    )
                except Exception as e:
                    logger.debug(f"Failed to update progress: {e}")

        # Get final states (direct calls — agents are local objects)
        self._update_progress(
            redis_client, 95, simulation_days, len(all_states)
        )
        final_states = [agent.get_state() for agent in self.agents]

        # Get event logs
        self.event_logs = []
        for agent in self.agents:
            self.event_logs.extend(agent.get_event_log())

        return final_states

    def _analyze_results(
        self, final_states: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate engagement score, sentiment breakdown, and risk flags"""

        opinions = [
            s.get("opinion") for s in final_states if s.get("opinion")
        ]

        sentiment_counts = {
            "positive": sum(1 for o in opinions if o == "POSITIVE"),
            "neutral": sum(1 for o in opinions if o == "NEUTRAL"),
            "negative": sum(1 for o in opinions if o == "NEGATIVE"),
        }

        total = len(opinions) or 1

        # Engagement score: high if strong reactions (positive OR negative)
        strong_reactions = (
            sentiment_counts["positive"] + sentiment_counts["negative"]
        )
        engagement_score = (strong_reactions / total) * 100

        # Detect controversies
        risk_flags = self._detect_controversies(final_states)

        # Prepare agent logs for storage
        agent_logs = self.event_logs[:1000]

        # Extract opinion trajectory for top 50 agents
        opinion_trajectory = {}
        for state in final_states[:50]:
            agent_id = state.get("agent_id")
            opinion_history = state.get("opinion_history")
            if agent_id and opinion_history is not None:
                opinion_trajectory[agent_id] = opinion_history

        # Build map data (lightweight for map rendering)
        map_data = []
        for state in final_states:
            profile = state.get("profile", {})
            agent_id = state.get("agent_id", "")
            map_data.append({
                "agent_id": agent_id,
                "coordinates": profile.get("coordinates", [0, 0]),
                "opinion": state.get("opinion", "NEUTRAL"),
                "friends": self.social_network.get(agent_id, []),
            })

        # Build enriched agent states (for detail popups)
        agent_states = []
        for state in final_states:
            profile = state.get("profile", {})
            agent_states.append({
                "agent_id": state.get("agent_id", ""),
                "coordinates": profile.get("coordinates", [0, 0]),
                "opinion": state.get("opinion", "NEUTRAL"),
                "emotion": state.get("emotion", "neutral"),
                "emotion_intensity": state.get("emotion_intensity", 0),
                "reasoning": state.get("reasoning", ""),
                "friends": self.social_network.get(state.get("agent_id", ""), []),
                "profile": {
                    "name": profile.get("name"),
                    "age": profile.get("age"),
                    "gender": profile.get("gender"),
                    "location": profile.get("location"),
                    "occupation": profile.get("occupation"),
                    "education": profile.get("education"),
                    "income_level": profile.get("income_level"),
                    "religion": profile.get("religion"),
                    "ethnicity": profile.get("ethnicity"),
                    "social_media_usage": profile.get("social_media_usage"),
                    "political_leaning": profile.get("political_leaning"),
                    "personality_traits": profile.get("personality_traits", []),
                    "values": profile.get("values", []),
                },
            })

        return {
            "engagement_score": round(engagement_score, 2),
            "sentiment_breakdown": sentiment_counts,
            "total_agents": len(final_states),
            "responding_agents": len(opinions),
            "risk_flags": risk_flags,
            "agent_logs": agent_logs,
            "map_data": map_data,
            "agent_states": agent_states,
            "opinion_trajectory": opinion_trajectory,
        }

    def _detect_controversies(
        self, final_states: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Identify controversial reactions by demographic segment"""
        flags = []

        # Add an 'overall' bucket to catch widespread backlash regardless of demographic
        groups = {"overall": {"All Agents": []}, "age": {}, "gender": {}, "location": {}, "values": {}}

        for state in final_states:
            profile = state.get("profile", {})
            opinion = state.get("opinion")
            if not opinion:
                continue

            # Overall
            groups["overall"]["All Agents"].append(state)

            # Age groups
            age = profile.get("age", 0)
            age_bracket = f"{(age // 10) * 10}-{(age // 10) * 10 + 9}"
            groups["age"].setdefault(age_bracket, []).append(state)

            # Gender
            gender = profile.get("gender", "Unknown")
            groups["gender"].setdefault(gender, []).append(state)

            # Location
            location = profile.get("location", "Unknown")
            groups["location"].setdefault(location, []).append(state)

            # Values
            for value in profile.get("values", []):
                groups["values"].setdefault(value, []).append(state)

        total_responding = len(groups["overall"]["All Agents"])
        min_group_size = 5 if total_responding >= 20 else 1

        overall_states = groups["overall"]["All Agents"]
        overall_negative_rate = sum(1 for s in overall_states if s.get("opinion") == "NEGATIVE") / max(1, total_responding)

        seen_reasonings = set()

        for group_type, group_data in groups.items():
            for group_name, states in group_data.items():
                if len(states) < min_group_size and group_type != "overall":
                    continue

                negative_count = sum(1 for s in states if s.get("opinion") == "NEGATIVE")
                total = len(states)
                negative_rate = negative_count / max(1, total)

                # Skip if not generally negative
                if negative_rate < 0.5:
                    continue

                # If this is a subset demographic, only flag it distinctively if it is notably worse than the general population.
                # If the general population already hates it (e.g. overall = 90%), we don't need to report every single trait individually.
                if group_type != "overall" and negative_rate < (overall_negative_rate + 0.15):
                    continue

                if negative_rate > 0.8:
                    severity = "CRITICAL"
                elif negative_rate > 0.7:
                    severity = "HIGH"
                elif negative_rate > 0.6:
                    severity = "MEDIUM"
                else:
                    severity = "LOW"

                sample_reactions = []
                for s in states:
                    if s.get("opinion") == "NEGATIVE":
                        reasoning = s.get("reasoning", "")[:120]
                        if reasoning and reasoning not in seen_reasonings:
                            sample_reactions.append({
                                "agent_id": s.get("agent_id"),
                                "reasoning": reasoning
                            })
                            seen_reasonings.add(reasoning)
                    if len(sample_reactions) >= 3:
                        break

                # Fallback if no uniquely new reasonings exist
                if not sample_reactions:
                    sample_reactions = [
                        {"agent_id": s.get("agent_id"), "reasoning": s.get("reasoning", "")[:120]}
                        for s in states if s.get("opinion") == "NEGATIVE"
                    ][:3]

                flags.append({
                    "flag_type": f"{group_type.upper()}_BACKLASH",
                    "severity": severity,
                    "description": f"{int(negative_rate * 100)}% of {group_type}={group_name} reacted negatively",
                    "affected_demographics": {group_type: group_name},
                    "sample_agent_reactions": sample_reactions,
                })

        severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        flags.sort(key=lambda x: severity_order.get(x["severity"], 4))

        return flags[:10]

    def _update_progress(
        self, redis_client, progress: int, current_day: int,
        active_agents: int
    ):
        """Update progress in Redis for frontend polling"""
        if redis_client:
            try:
                status = {
                    "progress": progress,
                    "current_day": current_day,
                    "active_agents": active_agents,
                }
                redis_client.setex(
                    f"sim:{self.experiment_id}:status",
                    60,
                    json.dumps(status),
                )
            except Exception as e:
                logger.debug(f"Failed to update progress: {e}")

    def _cleanup(self):
        """Clean up resources"""
        self.agents = []
        shutdown_llm_pool()
        shutdown_ray()


async def run_simulation_async(
    experiment_id: str,
    ad_content: str,
    demographic_filter: Optional[Dict[str, Any]] = None,
    num_agents: int = 10,
    simulation_days: int = 5,
    redis_client=None,
    custom_agent_profiles: Optional[List[Dict]] = None,
    use_custom_agents_only: bool = False,
) -> Dict[str, Any]:
    """
    Async convenience function to run a simulation.
    """
    mqtt_host = _clean_env("MQTT_BROKER_HOST", "localhost")
    mqtt_port = int(_clean_env("MQTT_BROKER_PORT", "1883"))
    mqtt_transport = _clean_env("MQTT_TRANSPORT", "tcp")
    mqtt_path = _clean_env("MQTT_PATH", "") or None
    chroma_host = _clean_env("CHROMA_HOST", "localhost")
    chroma_port = int(_clean_env("CHROMA_PORT", "8000"))
    chroma_ssl = _clean_env("CHROMA_SSL", "False").lower() in ("true", "1", "yes")

    orchestrator = SimulationOrchestrator(
        experiment_id=experiment_id,
        num_agents=num_agents,
        mqtt_host=mqtt_host,
        mqtt_port=mqtt_port,
        mqtt_transport=mqtt_transport,
        mqtt_path=mqtt_path,
        chroma_host=chroma_host,
        chroma_port=chroma_port,
        chroma_ssl=chroma_ssl,
    )

    return await orchestrator.run(
        ad_content=ad_content,
        demographic_filter=demographic_filter,
        simulation_days=simulation_days,
        redis_client=redis_client,
        custom_agent_profiles=custom_agent_profiles,
        use_custom_agents_only=use_custom_agents_only,
    )


def run_simulation(
    experiment_id: str,
    ad_content: str,
    demographic_filter: Optional[Dict[str, Any]] = None,
    num_agents: int = 10,
    simulation_days: int = 5,
    redis_client=None,
    custom_agent_profiles: Optional[List[Dict]] = None,
    use_custom_agents_only: bool = False,
) -> Dict[str, Any]:
    """
    Synchronous convenience function to run a simulation.
    Called from Celery task or test scripts.
    """
    return asyncio.run(
        run_simulation_async(
            experiment_id=experiment_id,
            ad_content=ad_content,
            demographic_filter=demographic_filter,
            num_agents=num_agents,
            simulation_days=simulation_days,
            redis_client=redis_client,
            custom_agent_profiles=custom_agent_profiles,
            use_custom_agents_only=use_custom_agents_only,
        )
    )
