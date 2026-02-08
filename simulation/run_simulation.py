"""
Simulation orchestrator - manages large-scale agent simulations
"""
import logging
import time
import json
import os
from typing import List, Dict, Any, Optional
import ray

from simulation.ray_cluster import init_ray_cluster, shutdown_ray
from simulation.agents.social_agent import SocialAgent
from simulation.utils.profile_generator import ProfileGenerator
from simulation.llm_client import configure_gemini

logger = logging.getLogger(__name__)


class SimulationOrchestrator:
    """
    Orchestrate large-scale agent simulations
    
    Manages:
    - Agent spawning with Ray
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
        chroma_host: str = "localhost",
        chroma_port: int = 8000
    ):
        self.experiment_id = experiment_id
        self.num_agents = num_agents
        self.mqtt_host = mqtt_host
        self.mqtt_port = mqtt_port
        self.chroma_host = chroma_host
        self.chroma_port = chroma_port
        
        self.agents = []
        self.profiles = []
        self.social_network = {}
    
    def run(
        self,
        ad_content: str,
        demographic_filter: Optional[Dict[str, Any]] = None,
        simulation_days: int = 5,
        redis_client = None
    ) -> Dict[str, Any]:
        """
        Run full simulation
        
        Args:
            ad_content: VLM-generated description of ad
            demographic_filter: Target demographics
            simulation_days: Days to simulate
            redis_client: Redis client for progress updates
        
        Returns:
            Simulation results with virality score, sentiment, risk flags
        """
        logger.info(f"Starting simulation {self.experiment_id} with {self.num_agents} agents")
        
        try:
            # Configure LLM
            configure_gemini()
            
            # Initialize Ray cluster
            init_ray_cluster(num_cpus=None)  # Auto-detect CPUs
            
            # Generate profiles
            self._update_progress(redis_client, 5, 0, 0)
            self.profiles = ProfileGenerator.generate_profiles(
                self.num_agents,
                demographic_filter
            )
            logger.info(f"Generated {len(self.profiles)} agent profiles")
            
            # Create social network
            self._update_progress(redis_client, 10, 0, 0)
            self.social_network = ProfileGenerator.generate_social_network(
                self.profiles,
                avg_friends=8
            )
            logger.info("Social network created")
            
            # Spawn agents
            self._update_progress(redis_client, 15, 0, 0)
            self._spawn_agents()
            logger.info(f"Spawned {len(self.agents)} agents")
            
            # Have all agents perceive the ad
            self._update_progress(redis_client, 20, 1, len(self.agents))
            final_states = self._run_simulation(ad_content, simulation_days, redis_client)
            
            # Analyze results
            results = self._analyze_results(final_states)
            
            # Cleanup
            self._cleanup()
            
            logger.info(f"Simulation complete. Virality score: {results['virality_score']:.1f}")
            
            return results
            
        except Exception as e:
            logger.error(f"Simulation failed: {e}")
            self._cleanup()
            raise
    
    def _spawn_agents(self):
        """Spawn all agents as Ray actors"""
        self.agents = []
        
        for profile in self.profiles:
            agent_id = profile['agent_id']
            friends = self.social_network.get(agent_id, [])
            
            agent = SocialAgent.remote(
                agent_id=agent_id,
                profile=profile,
                experiment_id=self.experiment_id,
                friends=friends,
                mqtt_host=self.mqtt_host,
                mqtt_port=self.mqtt_port,
                chroma_host=self.chroma_host,
                chroma_port=self.chroma_port
            )
            
            self.agents.append(agent)
    
    def _run_simulation(
        self,
        ad_content: str,
        simulation_days: int,
        redis_client = None
    ) -> List[Dict[str, Any]]:
        """
        Run the actual simulation
        
        Each agent perceives the ad and forms an opinion
        """
        # Have all agents perceive the ad (parallel execution)
        logger.info("Broadcasting ad content to all agents...")
        
        # Process in batches to avoid overwhelming the system
        batch_size = 50
        all_states = []
        
        for i in range(0, len(self.agents), batch_size):
            batch = self.agents[i:i + batch_size]
            
            # Start processing for this batch
            futures = [agent.perceive_ad.remote(ad_content) for agent in batch]
            
            # Wait for batch to complete
            batch_states = ray.get(futures)
            all_states.extend(batch_states)
            
            # Update progress
            progress = 20 + int((i + len(batch)) / len(self.agents) * 60)
            # Guard against division by zero when agents < simulation_days
            agents_per_day = max(1, len(self.agents) // max(1, simulation_days))
            current_day = min((i // agents_per_day) + 1, simulation_days)
            self._update_progress(redis_client, progress, current_day, len(all_states))
            
            logger.info(f"Processed {len(all_states)}/{len(self.agents)} agents")
        
        # Simulate social influence over days
        for day in range(1, simulation_days + 1):
            self._update_progress(redis_client, 80 + day * 3, day, len(all_states))
            time.sleep(0.5)  # Brief pause between days
        
        # Get final states
        self._update_progress(redis_client, 95, simulation_days, len(all_states))
        final_futures = [agent.get_state.remote() for agent in self.agents]
        final_states = ray.get(final_futures)
        
        # Get event logs
        log_futures = [agent.get_event_log.remote() for agent in self.agents]
        all_logs = ray.get(log_futures)
        
        # Flatten logs
        self.event_logs = []
        for logs in all_logs:
            self.event_logs.extend(logs)
        
        return final_states
    
    def _analyze_results(self, final_states: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate virality score, sentiment breakdown, and risk flags"""
        
        # Count opinions
        opinions = [s.get('opinion') for s in final_states if s.get('opinion')]
        
        sentiment_counts = {
            "positive": sum(1 for o in opinions if o == 'POSITIVE'),
            "neutral": sum(1 for o in opinions if o == 'NEUTRAL'),
            "negative": sum(1 for o in opinions if o == 'NEGATIVE')
        }
        
        total = len(opinions) or 1
        
        # Virality score: high if strong reactions (positive OR negative)
        strong_reactions = sentiment_counts['positive'] + sentiment_counts['negative']
        virality_score = (strong_reactions / total) * 100
        
        # Detect controversies
        risk_flags = self._detect_controversies(final_states)
        
        # Prepare agent logs for storage
        agent_logs = self.event_logs[:1000]  # Limit to 1000 logs
        
        return {
            "virality_score": round(virality_score, 2),
            "sentiment_breakdown": sentiment_counts,
            "total_agents": len(final_states),
            "responding_agents": len(opinions),
            "risk_flags": risk_flags,
            "agent_logs": agent_logs
        }
    
    def _detect_controversies(self, final_states: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Identify controversial reactions by demographic segment"""
        flags = []
        
        # Group by various demographics
        groups = {
            'age': {},
            'gender': {},
            'location': {},
            'values': {}
        }
        
        # Populate groups
        for state in final_states:
            profile = state.get('profile', {})
            opinion = state.get('opinion')
            
            if not opinion:
                continue
            
            # Age groups
            age = profile.get('age', 0)
            age_bracket = f"{(age // 10) * 10}-{(age // 10) * 10 + 9}"
            if age_bracket not in groups['age']:
                groups['age'][age_bracket] = []
            groups['age'][age_bracket].append(state)
            
            # Gender
            gender = profile.get('gender', 'Unknown')
            if gender not in groups['gender']:
                groups['gender'][gender] = []
            groups['gender'][gender].append(state)
            
            # Location
            location = profile.get('location', 'Unknown')
            if location not in groups['location']:
                groups['location'][location] = []
            groups['location'][location].append(state)
            
            # Values
            for value in profile.get('values', []):
                if value not in groups['values']:
                    groups['values'][value] = []
                groups['values'][value].append(state)
        
        # Check each group for high negativity
        for group_type, group_data in groups.items():
            for group_name, states in group_data.items():
                if len(states) < 5:  # Skip small groups
                    continue
                
                negative_count = sum(1 for s in states if s.get('opinion') == 'NEGATIVE')
                total = len(states)
                negative_rate = negative_count / total
                
                if negative_rate > 0.5:  # More than 50% negative
                    # Determine severity
                    if negative_rate > 0.8:
                        severity = "CRITICAL"
                    elif negative_rate > 0.7:
                        severity = "HIGH"
                    elif negative_rate > 0.6:
                        severity = "MEDIUM"
                    else:
                        severity = "LOW"
                    
                    # Get sample reactions
                    sample_reactions = [
                        {
                            "agent_id": s.get('agent_id'),
                            "reasoning": s.get('reasoning', '')[:100]
                        }
                        for s in states if s.get('opinion') == 'NEGATIVE'
                    ][:3]
                    
                    flags.append({
                        "flag_type": f"{group_type.upper()}_BACKLASH",
                        "severity": severity,
                        "description": f"{int(negative_rate * 100)}% of {group_type}={group_name} reacted negatively",
                        "affected_demographics": {group_type: group_name},
                        "sample_agent_reactions": sample_reactions
                    })
        
        # Sort by severity
        severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        flags.sort(key=lambda x: severity_order.get(x['severity'], 4))
        
        return flags[:10]  # Top 10 risk flags
    
    def _update_progress(self, redis_client, progress: int, current_day: int, active_agents: int):
        """Update progress in Redis for frontend polling"""
        if redis_client:
            try:
                status = {
                    "progress": progress,
                    "current_day": current_day,
                    "active_agents": active_agents
                }
                redis_client.setex(
                    f"sim:{self.experiment_id}:status",
                    60,  # 60 second TTL
                    json.dumps(status)
                )
            except Exception as e:
                logger.debug(f"Failed to update progress: {e}")
    
    def _cleanup(self):
        """Clean up resources"""
        # Cleanup agents
        for agent in self.agents:
            try:
                ray.get(agent.cleanup.remote())
            except:
                pass
        
        self.agents = []
        
        # Shutdown Ray
        shutdown_ray()


def run_simulation(
    experiment_id: str,
    ad_content: str,
    demographic_filter: Optional[Dict[str, Any]] = None,
    num_agents: int = 10,
    simulation_days: int = 5,
    redis_client = None
) -> Dict[str, Any]:
    """
    Convenience function to run a simulation
    
    Called from Celery task
    """
    # Get config from environment
    mqtt_host = os.getenv("MQTT_BROKER_HOST", "localhost")
    mqtt_port = int(os.getenv("MQTT_BROKER_PORT", 1883))
    chroma_host = os.getenv("CHROMA_HOST", "localhost")
    chroma_port = int(os.getenv("CHROMA_PORT", 8000))
    
    orchestrator = SimulationOrchestrator(
        experiment_id=experiment_id,
        num_agents=num_agents,
        mqtt_host=mqtt_host,
        mqtt_port=mqtt_port,
        chroma_host=chroma_host,
        chroma_port=chroma_port
    )
    
    return orchestrator.run(
        ad_content=ad_content,
        demographic_filter=demographic_filter,
        simulation_days=simulation_days,
        redis_client=redis_client
    )
