"""
Agent memory system using ChromaDB for vector storage.

If ChromaDB (HTTP server) is not reachable, all operations become no-ops
so the simulation continues without memory — never falls back to the
embedded in-memory client which crashes on Windows (hnswlib access violation).
"""
import logging
import os
import time
from typing import List, Dict, Any, Optional

# Suppress PostHog telemetry noise (capture() argument mismatch)
os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")
import chromadb

logger = logging.getLogger(__name__)


class AgentMemoryStore:
    """
    Vector database for storing and retrieving agent memories.

    Uses ChromaDB (HTTP mode only) for:
    - Agent profile embeddings
    - Past experiences and interactions
    - RAG (Retrieval Augmented Generation) context for decisions

    If ChromaDB is not available the store silently becomes a no-op so the
    simulation can run without memory rather than crashing.
    """

    def __init__(
        self,
        chroma_host: str = "localhost",
        chroma_port: int = 8000,
        collection_name: str = "agent_memories",
        ssl: bool = False,
    ):
        """
        Initialize connection to ChromaDB HTTP server.

        Falls back to disabled (no-op) mode instead of in-memory mode to
        avoid the Windows hnswlib C++ access violation crash.
        """
        self.collection = None  # None means disabled / no-op

        try:
            from chromadb.config import Settings as ChromaSettings
            client = chromadb.HttpClient(
                host=chroma_host,
                port=chroma_port,
                ssl=ssl,
                settings=ChromaSettings(
                    chroma_client_auth_provider=None,
                    anonymized_telemetry=False,  # suppress telemetry noise
                ),
            )

            # Heartbeat check — raises immediately if server is down
            client.heartbeat()

            self.collection = client.get_or_create_collection(
                name=collection_name,
            )
            logger.info(f"Connected to ChromaDB at {chroma_host}:{chroma_port}")

        except Exception as e:
            # Do NOT fall back to chromadb.Client() — the embedded hnswlib
            # backend crashes on Windows with an access violation.
            logger.info(
                f"ChromaDB not available at {chroma_host}:{chroma_port} "
                f"({type(e).__name__}: {e}). "
                f"Running without agent memory (simulation unaffected)."
            )
            self.collection = None

    @property
    def available(self) -> bool:
        """True if ChromaDB is connected and usable."""
        return self.collection is not None

    def create_agent_profile(self, agent_id: str, profile: Dict[str, Any]):
        """
        Store agent's demographic profile and values.
        No-op if ChromaDB is unavailable.
        """
        if not self.available:
            return

        values = profile.get('values', [])
        values_str = ', '.join(values) if values else 'Not specified'

        profile_text = f"""
Demographics:
- Age: {profile.get('age', 'Unknown')}
- Gender: {profile.get('gender', 'Unknown')}
- Location: {profile.get('location', 'Unknown')}
- Education: {profile.get('education', 'Not specified')}
- Occupation: {profile.get('occupation', 'Not specified')}

Core values: {values_str}
"""

        # Sanitize metadata: ChromaDB only accepts str, int, float, bool
        sanitized_profile = {}
        for key, value in profile.items():
            if isinstance(value, (str, int, float, bool)):
                sanitized_profile[key] = value
            elif isinstance(value, list):
                sanitized_profile[key] = ', '.join(str(v) for v in value)
            elif value is None:
                sanitized_profile[key] = ''
            else:
                sanitized_profile[key] = str(value)

        metadata = {"agent_id": agent_id, "type": "profile", **sanitized_profile}

        try:
            existing = self.collection.get(ids=[f"{agent_id}_profile"])
            if existing['ids']:
                self.collection.update(
                    ids=[f"{agent_id}_profile"],
                    documents=[profile_text],
                    metadatas=[metadata]
                )
            else:
                self.collection.add(
                    ids=[f"{agent_id}_profile"],
                    documents=[profile_text],
                    metadatas=[metadata]
                )
            logger.debug(f"Stored profile for agent {agent_id}")

        except Exception as e:
            logger.error(f"Failed to store profile for {agent_id}: {e}")

    def add_experience(
        self,
        agent_id: str,
        experience: str,
        experience_type: str = "interaction"
    ):
        """
        Store a past interaction or experience.
        No-op if ChromaDB is unavailable.
        """
        if not self.available:
            return

        experience_id = f"{agent_id}_exp_{int(time.time() * 1000)}"

        try:
            self.collection.add(
                ids=[experience_id],
                documents=[experience],
                metadatas=[{
                    "agent_id": agent_id,
                    "type": experience_type,
                    "timestamp": time.time()
                }]
            )
            logger.debug(f"Added experience for {agent_id}: {experience[:50]}...")

        except Exception as e:
            logger.error(f"Failed to add experience for {agent_id}: {e}")

    def query_relevant_context(
        self,
        agent_id: str,
        query: str,
        n_results: int = 3
    ) -> List[str]:
        """
        Retrieve relevant memories for decision-making (RAG).
        Returns empty list if ChromaDB is unavailable.
        """
        if not self.available:
            return []

        try:
            results = self.collection.query(
                query_texts=[query],
                where={"agent_id": agent_id},
                n_results=n_results
            )

            if results and results['documents']:
                return results['documents'][0]
            return []

        except Exception as e:
            logger.error(f"Failed to query memories for {agent_id}: {e}")
            return []

    def get_agent_profile(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """
        Get stored profile for an agent.
        Returns None if ChromaDB is unavailable.
        """
        if not self.available:
            return None

        try:
            results = self.collection.get(
                ids=[f"{agent_id}_profile"],
                include=["metadatas"]
            )

            if results and results['metadatas']:
                return results['metadatas'][0]
            return None

        except Exception as e:
            logger.error(f"Failed to get profile for {agent_id}: {e}")
            return None

    def clear_agent_memories(self, agent_id: str):
        """
        Remove all memories for an agent.
        No-op if ChromaDB is unavailable.
        """
        if not self.available:
            return

        try:
            results = self.collection.get(
                where={"agent_id": agent_id},
                include=["metadatas"]
            )

            if results and results['ids']:
                self.collection.delete(ids=results['ids'])
                logger.info(f"Cleared {len(results['ids'])} memories for {agent_id}")

        except Exception as e:
            logger.error(f"Failed to clear memories for {agent_id}: {e}")

    def clear_all(self):
        """
        Clear entire collection.
        No-op if ChromaDB is unavailable.
        """
        if not self.available:
            return

        try:
            self.collection.delete(where={})
            logger.info("Cleared all agent memories")

        except Exception as e:
            logger.error(f"Failed to clear all memories: {e}")
