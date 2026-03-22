"""
LLM client using Qwen model via HuggingFace Space (Ollama-compatible API)
with Ray actor pool for parallel processing.

Architecture:
- Each Ray actor makes HTTP requests to the Qwen Ollama endpoint
- Actor pool distributes requests with round-robin
- Robust retry with exponential backoff
"""
import os
import random
import time
import asyncio
import logging
import json
from pathlib import Path
from typing import Optional
from multiprocessing import cpu_count

import ray
import requests

# Load environment variables from .env file
from dotenv import load_dotenv
env_paths = [
    Path(__file__).parent.parent / ".env",
    Path(__file__).parent / ".env",
    Path.cwd() / ".env",
]
for env_path in env_paths:
    if env_path.exists():
        load_dotenv(env_path)
        break

logger = logging.getLogger(__name__)

# Default Qwen API configuration
DEFAULT_QWEN_API_URL = "https://vish85521-doc.hf.space/api/generate"
DEFAULT_QWEN_MODEL = "qwen3.5:397b-cloud"


@ray.remote
class QwenActor:
    """
    Ray actor that sends requests to a Qwen model via Ollama-compatible HTTP API.

    Makes HTTP POST requests to the HuggingFace Space endpoint.
    Supports streaming NDJSON responses.
    """

    def __init__(self):
        """Initialize with API config from environment."""
        self._api_url = os.getenv("QWEN_API_URL", DEFAULT_QWEN_API_URL)
        self._model_name = os.getenv("QWEN_MODEL_NAME", DEFAULT_QWEN_MODEL)
        self._session = requests.Session()
        self._session.headers.update({"Content-Type": "application/json"})

        # Optional: HuggingFace token for private spaces
        hf_token = os.getenv("HF_TOKEN", "")
        if hf_token:
            self._session.headers["Authorization"] = f"Bearer {hf_token}"

        print(f"[QwenActor] Initialized — endpoint: {self._api_url}, model: {self._model_name}")

    def call(
        self,
        prompt: str,
        max_tokens: int = 200,
        temperature: float = 0.7,
        model_name: str = None,
        retries: int = 5,
    ) -> str:
        """
        Send a request to the Qwen Ollama API with retry and exponential backoff.

        Args:
            prompt: The prompt to send
            max_tokens: Maximum tokens to generate (passed as num_predict)
            temperature: Sampling temperature
            model_name: Override model name (uses env default if None)
            retries: Number of retries on failure

        Returns:
            Generated text response
        """
        model = model_name or self._model_name
        last_error = None

        for attempt in range(retries):
            try:
                print(f"[QwenActor] Attempt {attempt + 1}/{retries} calling {model}...")

                payload = {
                    "model": model,
                    "prompt": prompt,
                    "stream": True,
                    "format": "json",
                    "think": False
                }

                response = self._session.post(
                    self._api_url,
                    json=payload,
                    stream=True,
                    timeout=180,  # 3 minute timeout (free CPU is slow)
                )

                if response.status_code != 200:
                    raise Exception(
                        f"HTTP {response.status_code}: {response.text[:200]}"
                    )

                # Parse streaming NDJSON response
                full_response = ""
                full_thinking = ""
                for line in response.iter_lines():
                    if not line:
                        continue
                        
                    if isinstance(line, bytes):
                        line_str = line.decode('utf-8', errors='replace').strip()
                    else:
                        line_str = line.strip()
                        
                    if not line_str:
                        continue
                        
                    try:
                        data = json.loads(line_str)
                        if data.get("response"):
                            full_response += data["response"]
                        if data.get("thinking"):
                            full_thinking += data["thinking"]
                    except json.JSONDecodeError:
                        continue

                if full_response:
                    print(
                        f"[QwenActor] Success! Response: {len(full_response)} chars"
                    )
                    return full_response
                elif full_thinking and not full_response:
                     # Fallback in case it refused the JSON format and only gave thinking
                     print(f"[QwenActor] Warning: Got {len(full_thinking)} chars of thinking but no response string. Returning thinking instead.")
                     return full_thinking
                else:
                    print("[QwenActor] Empty response from model")
                    return ""

            except Exception as e:
                last_error = e
                wait_time = min(60, (2 ** attempt) + random.random() * 2)
                print(
                    f"[QwenActor] Error (attempt {attempt + 1}/{retries}), "
                    f"waiting {wait_time:.1f}s: {e}"
                )
                if attempt < retries - 1:
                    time.sleep(wait_time)
                else:
                    raise e

        # All retries exhausted
        if last_error:
            raise last_error
        return ""


class QwenLLM:
    """
    Manages a pool of QwenActor Ray actors for parallel LLM requests.

    Usage:
        llm = QwenLLM(num_actors=2)
        result = await llm.atext_request("Hello world")
        # or synchronously:
        result = llm.text_request("Hello world")
    """

    def __init__(self, num_actors: int = None):
        """
        Initialize the actor pool.

        Args:
            num_actors: Number of Ray actors to spawn.
                        Defaults to min(cpu_count(), 4).
        """
        if num_actors is None:
            num_actors = min(cpu_count(), 4)

        self._actors = [QwenActor.remote() for _ in range(num_actors)]
        self._next_index = 0
        logger.info(f"QwenLLM initialized with {num_actors} actors")

    def _get_next_actor(self):
        """Round-robin actor selection"""
        actor = self._actors[self._next_index % len(self._actors)]
        self._next_index += 1
        return actor

    async def atext_request(
        self,
        prompt: str,
        max_tokens: int = 200,
        temperature: float = 0.7,
        model_name: str = None,
        retries: int = 5,
    ) -> str:
        """
        Async request to the LLM actor pool.

        Selects an actor via round-robin and sends the request.

        Args:
            prompt: The prompt to send
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            model_name: Model override (uses env default if None)
            retries: Number of retries

        Returns:
            Generated text response
        """
        actor = self._get_next_actor()

        actor_idx = self._actors.index(actor) if actor in self._actors else '?'
        logger.info(f"LLM request dispatched to actor {actor_idx}")

        try:
            import time as _time
            _t0 = _time.time()
            result = await actor.call.remote(
                prompt=prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                model_name=model_name,
                retries=retries,
            )
            _elapsed = _time.time() - _t0
            logger.info(f"LLM actor {actor_idx} responded in {_elapsed:.1f}s")
            return result
        except Exception as e:
            logger.error(f"LLM request failed on actor {actor_idx}: {e}")
            return ""

    def text_request(
        self,
        prompt: str,
        max_tokens: int = 200,
        temperature: float = 0.7,
        model_name: str = None,
        retries: int = 5,
    ) -> str:
        """
        Synchronous wrapper for atext_request.
        Uses ray.get() to block until the result is ready.
        """
        actor = self._get_next_actor()
        try:
            result = ray.get(
                actor.call.remote(
                    prompt=prompt,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    model_name=model_name,
                    retries=retries,
                )
            )
            return result
        except Exception as e:
            logger.error(f"LLM request failed: {e}")
            return ""

    def shutdown(self):
        """Kill all actor handles"""
        for actor in self._actors:
            try:
                ray.kill(actor)
            except Exception:
                pass
        self._actors = []


# ---------------------------------------------------------------------------
# Backward-compatible convenience functions
# ---------------------------------------------------------------------------
_llm_pool: Optional[QwenLLM] = None


def get_llm_pool(num_actors: int = None) -> QwenLLM:
    """Get or create the global LLM actor pool"""
    global _llm_pool
    if _llm_pool is None:
        _llm_pool = QwenLLM(num_actors=num_actors)
    return _llm_pool


def shutdown_llm_pool():
    """Shutdown the global LLM pool"""
    global _llm_pool
    if _llm_pool is not None:
        _llm_pool.shutdown()
        _llm_pool = None


def call_llm_sync(
    prompt: str,
    max_tokens: int = 200,
    temperature: float = 0.7,
    model_name: str = None,
) -> str:
    """
    Legacy synchronous LLM call — delegates to the actor pool.
    """
    pool = get_llm_pool()
    return pool.text_request(
        prompt=prompt,
        max_tokens=max_tokens,
        temperature=temperature,
        model_name=model_name,
    )
