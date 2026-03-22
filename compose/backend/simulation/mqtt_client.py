"""
MQTT Client wrapper for agent communication
"""
import json
import logging
import ssl
import uuid
import time
from typing import Callable, Optional, Dict, Any
import paho.mqtt.client as mqtt

logger = logging.getLogger(__name__)


class AgentMQTTClient:
    """
    MQTT client for agent-to-agent and broadcast communication
    
    Topic structure:
    - exps/{exp_id}/agents/{agent_id}/inbox  → Direct messages to agent
    - exps/{exp_id}/broadcast                → Public posts (all agents subscribe)
    - exps/{exp_id}/admin/control            → Simulation control
    """
    
    def __init__(
        self,
        broker_host: str = "localhost",
        broker_port: int = 1883,
        client_id: Optional[str] = None,
        transport: str = "tcp",
        ws_path: Optional[str] = None,
    ):
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.client_id = client_id or f"agent_{uuid.uuid4().hex[:8]}"
        self.transport = transport
        self.ws_path = ws_path

        self.client = mqtt.Client(
            client_id=self.client_id,
            transport=self.transport,
        )

        # Websocket path (e.g. "/mqtt" for EMQX)
        if self.transport == "websockets" and self.ws_path:
            self.client.ws_set_options(path=self.ws_path)

        # Enable TLS/SSL for secure connections (port 443)
        if self.broker_port == 443:
            self.client.tls_set(
                ca_certs=None,           # use system CA bundle
                certfile=None,
                keyfile=None,
                cert_reqs=ssl.CERT_REQUIRED,
                tls_version=ssl.PROTOCOL_TLS_CLIENT,
            )

        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        self.client.on_disconnect = self._on_disconnect

        self.message_handlers: Dict[str, Callable] = {}
        self.connected = False
        self._connect_retries = 0
        self._max_retries = 5
    
    def _on_connect(self, client, userdata, flags, rc):
        """Callback when connected to broker"""
        if rc == 0:
            self.connected = True
            self._connect_retries = 0
            logger.debug(f"[{self.client_id}] Connected to MQTT broker")
            
            # Resubscribe to all topics
            for topic in self.message_handlers.keys():
                self.client.subscribe(topic)
        else:
            logger.error(f"[{self.client_id}] Connection failed with code {rc}")
    
    def _on_disconnect(self, client, userdata, rc):
        """Callback when disconnected"""
        self.connected = False
        if rc != 0:
            logger.warning(f"[{self.client_id}] Unexpected disconnect, code: {rc}")
    
    def _on_message(self, client, userdata, msg):
        """Route incoming messages to registered handlers"""
        try:
            topic = msg.topic
            payload = json.loads(msg.payload.decode())
            
            # Find matching handler
            if topic in self.message_handlers:
                self.message_handlers[topic](payload)
            else:
                # Check for wildcard matches
                for pattern, handler in self.message_handlers.items():
                    if self._topic_matches(pattern, topic):
                        handler(payload)
                        break
        except json.JSONDecodeError as e:
            logger.warning(f"Invalid JSON in message: {e}")
        except Exception as e:
            logger.error(f"Error handling message: {e}")
    
    def _topic_matches(self, pattern: str, topic: str) -> bool:
        """Check if topic matches pattern (with wildcards)"""
        pattern_parts = pattern.split('/')
        topic_parts = topic.split('/')
        
        if len(pattern_parts) != len(topic_parts):
            if '+' not in pattern and '#' not in pattern:
                return False
        
        for p, t in zip(pattern_parts, topic_parts):
            if p == '+':
                continue
            if p == '#':
                return True
            if p != t:
                return False
        
        return len(pattern_parts) == len(topic_parts)
    
    def connect(self) -> bool:
        """Connect to MQTT broker with retry"""
        while self._connect_retries < self._max_retries:
            try:
                self.client.connect(self.broker_host, self.broker_port, keepalive=60)
                return True
            except Exception as e:
                self._connect_retries += 1
                logger.warning(f"Connection attempt {self._connect_retries} failed: {e}")
                time.sleep(1)
        
        logger.error(f"Failed to connect after {self._max_retries} attempts")
        return False
    
    def subscribe(self, topic: str, handler: Callable[[Dict[str, Any]], None]):
        """
        Subscribe to a topic and register callback
        
        Args:
            topic: MQTT topic (can include + and # wildcards)
            handler: Function to call with parsed JSON payload
        """
        self.message_handlers[topic] = handler
        if self.connected:
            self.client.subscribe(topic)
            logger.debug(f"[{self.client_id}] Subscribed to {topic}")
    
    def publish(self, topic: str, message: Dict[str, Any], qos: int = 1):
        """
        Publish JSON message to topic
        
        Args:
            topic: Target topic
            message: Dict to serialize as JSON
            qos: Quality of service (0, 1, or 2)
        """
        try:
            payload = json.dumps(message)
            self.client.publish(topic, payload, qos=qos)
        except Exception as e:
            logger.error(f"Failed to publish: {e}")
    
    def start(self):
        """Start the network loop (non-blocking)"""
        self.connect()
        self.client.loop_start()
    
    def stop(self):
        """Stop the network loop and disconnect"""
        self.client.loop_stop()
        self.client.disconnect()
        self.connected = False
    
    def wait_for_connection(self, timeout: float = 5.0) -> bool:
        """Wait for connection to be established"""
        start = time.time()
        while not self.connected and (time.time() - start) < timeout:
            time.sleep(0.1)
        return self.connected
