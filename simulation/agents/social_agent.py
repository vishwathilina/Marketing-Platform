"""
SocialAgent - Ray Actor implementing AI agent behavior from AgentSociety paper
"""
import ray
import random
import logging
import json
import re
from typing import List, Dict, Any, Optional
from simulation.mqtt_client import AgentMQTTClient
from simulation.agents.agent_memory import AgentMemoryStore
from simulation.llm_client import call_llm_sync

logger = logging.getLogger(__name__)


@ray.remote
class SocialAgent:
    """
    Ray Actor representing a simulated person reacting to advertisements
    
    Implements:
    - Profile & Memory (Section 3.2 of AgentSociety paper)
    - Emotional state
    - Social interactions (Section 3.4)
    - Mind-Behavior Coupling for decision making
    """
    
    def __init__(
        self,
        agent_id: str,
        profile: Dict[str, Any],
        experiment_id: str,
        friends: List[str] = None,
        mqtt_host: str = "localhost",
        mqtt_port: int = 1883,
        chroma_host: str = "localhost",
        chroma_port: int = 8000,
        api_key: str = None
    ):
        """
        Initialize agent with profile and communication channels
        """
        # Configure LLM client with API key for this Ray actor
        if api_key:
            from simulation.llm_client import configure_gemini
            configure_gemini(api_key)
        self.agent_id = agent_id
        self.profile = profile
        self.experiment_id = experiment_id
        self.friends = friends or []
        
        # Internal state
        self.emotion = "neutral"  # happy, angry, sad, neutral
        self.emotion_intensity = 0.0  # 0-1 scale
        self.opinion_on_ad = None  # positive, neutral, negative
        self.has_seen_ad = False
        self.reasoning = ""
        
        # Event log for this agent
        self.event_log: List[Dict[str, Any]] = []
        
        # Initialize memory system
        try:
            self.memory = AgentMemoryStore(
                chroma_host=chroma_host,
                chroma_port=chroma_port,
                collection_name=f"exp_{experiment_id}"
            )
            self.memory.create_agent_profile(agent_id, profile)
        except Exception as e:
            logger.warning(f"Agent {agent_id}: Memory init failed: {e}")
            self.memory = None
        
        # Initialize MQTT (optional - can work without it)
        self.mqtt = None
        try:
            self.mqtt = AgentMQTTClient(
                broker_host=mqtt_host,
                broker_port=mqtt_port,
                client_id=f"{experiment_id}_{agent_id}"
            )
            
            # Subscribe to direct messages and broadcasts
            self.mqtt.subscribe(
                f"exps/{experiment_id}/agents/{agent_id}/inbox",
                self._handle_direct_message
            )
            self.mqtt.subscribe(
                f"exps/{experiment_id}/broadcast",
                self._handle_broadcast
            )
            self.mqtt.start()
            
        except Exception as e:
            logger.debug(f"Agent {agent_id}: MQTT init skipped: {e}")
        
        logger.debug(f"Agent {agent_id} initialized: {profile.get('age')}yo {profile.get('gender')} from {profile.get('location')}")
    
    def _handle_direct_message(self, message: Dict[str, Any]):
        """Process direct messages to this agent"""
        if message.get('type') == 'AD_CONTENT' and not self.has_seen_ad:
            self.perceive_ad(message.get('content', ''))
    
    def _handle_broadcast(self, message: Dict[str, Any]):
        """Process broadcast messages from other agents"""
        sender = message.get('agent_id', '')
        msg_type = message.get('type', '')
        
        # Only process messages from friends
        if sender in self.friends and msg_type in ['BOYCOTT', 'ENDORSEMENT']:
            self._social_influence(message)
    
    def perceive_ad(self, ad_content: str) -> Dict[str, Any]:
        """
        Main decision-making: React to advertisement content
        
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
            memory_context = self.memory.query_relevant_context(
                self.agent_id,
                ad_content,
                n_results=3
            )
        
        # Step 2: Build prompt with personality
        prompt = self._build_reaction_prompt(ad_content, memory_context)
        
        # Step 3: Get LLM response
        try:
            response = call_llm_sync(prompt, max_tokens=500)
            parsed = self._parse_llm_response(response)
            
            self.opinion_on_ad = parsed['opinion']
            self.emotion = parsed['emotion']
            self.emotion_intensity = parsed['intensity']
            self.reasoning = parsed['reasoning']
            
            # Step 4: Take action based on opinion
            if parsed['opinion'] == 'NEGATIVE':
                self._post_boycott(parsed['reasoning'])
                self._log_event('BOYCOTT', parsed['reasoning'])
                
            elif parsed['opinion'] == 'POSITIVE':
                # Probabilistic sharing
                if random.random() < self._get_sharing_probability():
                    self._post_endorsement(parsed['reasoning'])
                self._log_event('ENDORSEMENT', parsed['reasoning'])
                
            else:
                self._log_event('IGNORE', 'No strong reaction')
            
            # Step 5: Update memory
            if self.memory:
                self.memory.add_experience(
                    self.agent_id,
                    f"Reacted {parsed['opinion']} to ad: {parsed['reasoning'][:100]}",
                    experience_type=parsed['opinion'].lower()
                )
            
        except Exception as e:
            logger.error(f"Agent {self.agent_id} failed to process ad: {e}")
            self.opinion_on_ad = "NEUTRAL"
            self._log_event('ERROR', str(e))
        
        return self.get_state()
    
    def _build_reaction_prompt(self, ad_content: str, memory_context: List[str]) -> str:
        """Build LLM prompt with agent personality"""
        values = self.profile.get('values', [])
        values_str = ', '.join(values) if values else 'Not specified'
        
        memory_str = '\n'.join(memory_context) if memory_context else 'No past experiences'
        
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
            'emotion': 'neutral',
            'opinion': 'NEUTRAL',
            'reasoning': '',
            'intensity': 0.3
        }
        
        try:
            # Find JSON in response
            json_match = re.search(r'\{[^{}]*\}', response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                
                emotion = data.get('emotion', 'NEUTRAL').upper()
                opinion = data.get('opinion', 'NEUTRAL').upper()
                
                # Validate values
                if opinion not in ['POSITIVE', 'NEUTRAL', 'NEGATIVE']:
                    opinion = 'NEUTRAL'
                
                # Calculate intensity
                intensity = 0.8 if opinion in ['POSITIVE', 'NEGATIVE'] else 0.3
                
                return {
                    'emotion': emotion.lower(),
                    'opinion': opinion,
                    'reasoning': data.get('reasoning', ''),
                    'intensity': intensity
                }
        except Exception as e:
            logger.warning(f"Failed to parse LLM response: {e}")
        
        return default
    
    def _social_influence(self, peer_message: Dict[str, Any]):
        """
        Handle social influence from peers
        
        If a friend boycotts/endorses, consider changing opinion
        """
        peer_opinion = "NEGATIVE" if peer_message.get('type') == 'BOYCOTT' else 'POSITIVE'
        
        # Only influence if current opinion differs
        if self.opinion_on_ad and self.opinion_on_ad != peer_opinion:
            # Calculate influence probability based on relationship
            influence_prob = 0.25  # Base 25% chance
            
            if random.random() < influence_prob:
                old_opinion = self.opinion_on_ad
                self.opinion_on_ad = peer_opinion
                
                self._log_event(
                    'OPINION_CHANGE',
                    f"Changed from {old_opinion} to {peer_opinion} due to {peer_message.get('agent_id')}"
                )
    
    def _post_boycott(self, reasoning: str):
        """Publish boycott message"""
        if self.mqtt:
            self.mqtt.publish(
                f"exps/{self.experiment_id}/broadcast",
                {
                    "agent_id": self.agent_id,
                    "type": "BOYCOTT",
                    "message": f"I will not support this brand. {reasoning[:100]}",
                    "sentiment_score": -0.8
                }
            )
    
    def _post_endorsement(self, reasoning: str):
        """Publish endorsement message"""
        if self.mqtt:
            self.mqtt.publish(
                f"exps/{self.experiment_id}/broadcast",
                {
                    "agent_id": self.agent_id,
                    "type": "ENDORSEMENT",
                    "message": f"I love this ad! {reasoning[:100]}",
                    "sentiment_score": 0.8
                }
            )
    
    def _get_sharing_probability(self) -> float:
        """Calculate likelihood of sharing based on personality"""
        # Higher for younger users and those with social values
        base_prob = 0.3
        
        age = self.profile.get('age', 35)
        if age < 25:
            base_prob += 0.2
        elif age < 35:
            base_prob += 0.1
        
        return min(base_prob, 0.6)
    
    def _log_event(self, event_type: str, details: str):
        """Log an event locally"""
        self.event_log.append({
            "agent_id": self.agent_id,
            "event_type": event_type,
            "details": details,
            "opinion": self.opinion_on_ad,
            "emotion": self.emotion
        })
    
    def get_state(self) -> Dict[str, Any]:
        """Get current agent state"""
        return {
            "agent_id": self.agent_id,
            "opinion": self.opinion_on_ad,
            "emotion": self.emotion,
            "emotion_intensity": self.emotion_intensity,
            "reasoning": self.reasoning,
            "has_seen_ad": self.has_seen_ad,
            "profile": self.profile
        }
    
    def get_event_log(self) -> List[Dict[str, Any]]:
        """Get all logged events"""
        return self.event_log
    
    def cleanup(self):
        """Clean up resources"""
        if self.mqtt:
            self.mqtt.stop()
