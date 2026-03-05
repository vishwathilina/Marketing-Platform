"""
SocialAgent - AI agent behavior for ad reaction simulation.

No longer a Ray actor — agents are plain Python objects.
LLM calls go through a shared GeminiLLM actor pool (Ray-backed).
This follows AgentSociety's pattern where agents are regular objects
and only LLM calls are distributed via Ray actors.
"""
import random
import logging
import json
import re
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class SocialAgent:
    """
    Simulated person reacting to advertisements.

    Implements:
    - Profile & Memory
    - Emotional state
    - Social interactions
    - Mind-Behavior Coupling for decision making

    NOTE: No @ray.remote — this is a plain object. LLM calls are dispatched
    through the GeminiLLM actor pool passed in via `llm_pool`.
    """

    def __init__(
        self,
        agent_id: str,
        profile: Dict[str, Any],
        experiment_id: str,
        llm_pool=None,
        friends: List[str] = None,
        memory_store=None,
    ):
        """
        Initialize agent with profile.

        Args:
            agent_id: Unique identifier
            profile: Demographics and values dict
            experiment_id: Experiment this agent belongs to
            llm_pool: GeminiLLM actor pool for LLM calls
            friends: List of friend agent IDs
            memory_store: Optional AgentMemoryStore instance (shared)
        """
        self.agent_id = agent_id
        self.profile = profile
        self.experiment_id = experiment_id
        self.llm_pool = llm_pool
        self.friends = friends or []

        # Internal state
        self.emotion = "neutral"
        self.emotion_intensity = 0.0
        self.opinion_on_ad = None
        self.has_seen_ad = False
        self.reasoning = ""

        # Event log for this agent
        self.event_log: List[Dict[str, Any]] = []

        # Optional memory (ChromaDB) — may be None
        self.memory = None
        if memory_store:
            try:
                memory_store.create_agent_profile(agent_id, profile)
                self.memory = memory_store
            except Exception as e:
                logger.debug(f"Agent {agent_id}: Memory init skipped: {e}")

        logger.debug(
            f"Agent {agent_id} initialized: "
            f"{profile.get('age')}yo {profile.get('gender')} "
            f"from {profile.get('location')}"
        )

    async def perceive_ad(self, ad_content: str) -> Dict[str, Any]:
        """
        Main decision-making: React to advertisement content (async).

        Implements Mind-Behavior Coupling:
        1. Retrieve relevant memories (RAG)
        2. Generate emotional response via LLM
        3. Form opinion
        4. Take action
        """
        self.has_seen_ad = True

        # Step 1: Query memory for relevant context
        memory_context = []
        if self.memory:
            try:
                logger.info(f"[{self.agent_id}] Querying memory for context...")
                memory_context = self.memory.query_relevant_context(
                    self.agent_id, ad_content, n_results=3
                )
                logger.info(f"[{self.agent_id}] Memory returned {len(memory_context)} items")
            except Exception as me:
                logger.warning(f"[{self.agent_id}] Memory query failed: {me}")

        # Step 2: Build prompt with personality
        prompt = self._build_reaction_prompt(ad_content, memory_context)

        # Step 3: Get LLM response via actor pool
        try:
            if self.llm_pool:
                import time as _time
                _t0 = _time.time()
                logger.info(f"[{self.agent_id}] Sending LLM request...")
                response = await self.llm_pool.atext_request(
                    prompt=prompt, max_tokens=500
                )
                _elapsed = _time.time() - _t0
                logger.info(f"[{self.agent_id}] LLM responded in {_elapsed:.1f}s ({len(response)} chars)")
            else:
                logger.warning(f"[{self.agent_id}] No LLM pool available!")
                response = ""

            parsed = self._parse_llm_response(response)
            logger.info(f"[{self.agent_id}] Raw LLM response: {response[:200]}")
            logger.info(f"[{self.agent_id}] Result: {parsed['emotion']} / {parsed['opinion']} (intensity: {parsed['intensity']})")

            self.opinion_on_ad = parsed["opinion"]
            self.emotion = parsed["emotion"]
            self.emotion_intensity = parsed["intensity"]
            self.reasoning = parsed["reasoning"]

            # Step 4: Take action based on opinion
            if parsed["opinion"] == "NEGATIVE":
                self._log_event("BOYCOTT", parsed["reasoning"])
            elif parsed["opinion"] == "POSITIVE":
                if random.random() < self._get_sharing_probability():
                    self._log_event("ENDORSEMENT", parsed["reasoning"])
                else:
                    self._log_event("ENDORSEMENT", parsed["reasoning"])
            else:
                self._log_event("IGNORE", "No strong reaction")

            # Step 5: Update memory
            if self.memory:
                try:
                    self.memory.add_experience(
                        self.agent_id,
                        f"Reacted {parsed['opinion']} to ad: {parsed['reasoning'][:100]}",
                        experience_type=parsed["opinion"].lower(),
                    )
                except Exception:
                    pass

        except Exception as e:
            logger.error(f"Agent {self.agent_id} failed to process ad: {e}")
            self.opinion_on_ad = "NEUTRAL"
            self._log_event("ERROR", str(e))

        return self.get_state()

    def _build_reaction_prompt(
        self, ad_content: str, memory_context: List[str]
    ) -> str:
        """Build LLM prompt with agent personality"""
        values = self.profile.get("values", [])
        values_str = ", ".join(values) if values else "Not specified"

        memory_str = (
            "\n".join(memory_context) if memory_context else "No past experiences"
        )

        return f"""You are roleplaying as a real person with this profile:
- Age: {self.profile.get('age', 'Unknown')}
- Gender: {self.profile.get('gender', 'Unknown')}
- Location: {self.profile.get('location', 'Unknown')}
- Occupation: {self.profile.get('occupation', 'Not specified')}
- Core values: {values_str}

Your past experiences:
{memory_str}

You just saw this advertisement:
{ad_content}

Analyze your reaction as this person:
1. How does this ad make you FEEL? (Choose one: HAPPY, ANGRY, SAD, NEUTRAL)
2. What is your OPINION? (Choose one: POSITIVE, NEUTRAL, NEGATIVE)
3. WHY do you feel this way? (2-3 sentences from YOUR perspective as this person)

You MUST respond in this JSON format:
{{"emotion": "ANGRY", "opinion": "NEGATIVE", "reasoning": "This ad shows something I disagree with because..."}}

Be authentic to the character's values and background. If something in the ad conflicts with their values, they should react negatively."""

    def _parse_llm_response(self, response: str) -> Dict[str, Any]:
        """Extract structured data from LLM response"""
        default = {
            "emotion": "neutral",
            "opinion": "NEUTRAL",
            "reasoning": "",
            "intensity": 0.3,
        }

        if not response:
            return default

        try:
            # Find JSON in response
            json_match = re.search(r"\{[^{}]*\}", response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())

                emotion = data.get("emotion", "NEUTRAL").upper()
                opinion = data.get("opinion", "NEUTRAL").upper()

                # Validate values
                if opinion not in ["POSITIVE", "NEUTRAL", "NEGATIVE"]:
                    opinion = "NEUTRAL"

                # Calculate intensity
                intensity = 0.8 if opinion in ["POSITIVE", "NEGATIVE"] else 0.3

                return {
                    "emotion": emotion.lower(),
                    "opinion": opinion,
                    "reasoning": data.get("reasoning", ""),
                    "intensity": intensity,
                }
        except Exception as e:
            logger.warning(f"Failed to parse LLM response: {e}")

        return default

    def social_influence(self, peer_opinion: str, peer_agent_id: str):
        """
        Handle social influence from peers.

        If a friend boycotts/endorses, consider changing opinion.
        """
        if self.opinion_on_ad and self.opinion_on_ad != peer_opinion:
            influence_prob = 0.25
            if random.random() < influence_prob:
                old_opinion = self.opinion_on_ad
                self.opinion_on_ad = peer_opinion
                self._log_event(
                    "OPINION_CHANGE",
                    f"Changed from {old_opinion} to {peer_opinion} "
                    f"due to {peer_agent_id}",
                )

    def _get_sharing_probability(self) -> float:
        """Calculate likelihood of sharing based on personality"""
        base_prob = 0.3
        age = self.profile.get("age", 35)
        if age < 25:
            base_prob += 0.2
        elif age < 35:
            base_prob += 0.1
        return min(base_prob, 0.6)

    def _log_event(self, event_type: str, details: str):
        """Log an event locally"""
        self.event_log.append(
            {
                "agent_id": self.agent_id,
                "event_type": event_type,
                "details": details,
                "opinion": self.opinion_on_ad,
                "emotion": self.emotion,
            }
        )

    def get_state(self) -> Dict[str, Any]:
        """Get current agent state"""
        return {
            "agent_id": self.agent_id,
            "opinion": self.opinion_on_ad,
            "emotion": self.emotion,
            "emotion_intensity": self.emotion_intensity,
            "reasoning": self.reasoning,
            "has_seen_ad": self.has_seen_ad,
            "profile": self.profile,
        }

    def get_event_log(self) -> List[Dict[str, Any]]:
        """Get all logged events"""
        return self.event_log
