"""
LLM client using Google Gemini with Ray actor pool for parallel processing.

Inspired by AgentSociety's LLMActor pattern:
- Each Ray actor holds its own genai.Client (no cross-process globals)
- Actor pool distributes requests with round-robin
- Robust retry with exponential backoff + random jitter
"""
import os
import random
import time
import asyncio
import logging
from pathlib import Path
from typing import Optional
from multiprocessing import cpu_count

import ray

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


class GeminiRateLimitError(Exception):
    """Custom exception for rate limit errors"""
    pass


def _is_rate_limit_error(exception) -> bool:
    """Check if exception is a rate limit error"""
    error_str = str(exception).lower()
    return any(x in error_str for x in ['rate', 'quota', '429', 'resource_exhausted'])


def _is_daily_quota_exhausted(exception) -> bool:
    """
    Return True when the DAILY quota is fully exhausted (limit: 0).
    In this case retrying within the same day is pointless — fail fast.
    """
    error_str = str(exception)
    return ('limit: 0' in error_str and
            'PerDay' in error_str and
            'resource_exhausted' in error_str.lower())


def _parse_retry_delay(exception) -> Optional[float]:
    """
    Parse the retryDelay the Gemini API suggests in the 429 response body.
    Returns seconds to wait, or None if not found.
    """
    import re
    error_str = str(exception)
    # e.g. 'retryDelay': '49s'  or  'retryDelay': '955.659136ms'
    match = re.search(r"retryDelay.*?'([\d.]+)(ms|s)'", error_str)
    if match:
        value, unit = float(match.group(1)), match.group(2)
        return value / 1000 if unit == 'ms' else value
    return None


@ray.remote
class GeminiActor:
    """
    Ray actor that holds multiple Gemini client instances for key rotation.

    Each actor creates a genai.Client per API key. When a key's daily quota
    is exhausted, the actor automatically rotates to the next key and retries.
    This multiplies the effective daily quota by the number of keys.
    """

    def __init__(self):
        """Initialize with API keys from environment (passed via Ray runtime_env)"""
        from google import genai

        # Collect all available API keys
        api_keys_str = os.getenv("GEMINI_API_KEYS", "")
        if api_keys_str:
            api_keys = [k.strip() for k in api_keys_str.split(",") if k.strip()]
        else:
            # Fall back to single key
            single_key = os.getenv("GEMINI_API_KEY", "")
            api_keys = [single_key] if single_key else []

        if not api_keys:
            print("[GeminiActor] ERROR: No API keys found! LLM calls will fail.")
            self._clients = []
            self._current_index = 0
            self._exhausted_keys = set()
            return

        # Create a genai.Client for each key
        self._clients = []
        for key in api_keys:
            self._clients.append(genai.Client(api_key=key))

        self._current_index = 0
        self._exhausted_keys = set()  # track which key indices are daily-exhausted

        print(f"[GeminiActor] Initialized with {len(self._clients)} API keys for rotation")

    def _get_client(self):
        """Get the current active client, skipping exhausted keys."""
        if not self._clients:
            return None, -1

        # If all keys exhausted, reset and try again (quota may have refreshed)
        if len(self._exhausted_keys) >= len(self._clients):
            print("[GeminiActor] All keys exhausted — resetting and retrying")
            self._exhausted_keys.clear()

        # Find next non-exhausted key
        for _ in range(len(self._clients)):
            idx = self._current_index % len(self._clients)
            if idx not in self._exhausted_keys:
                return self._clients[idx], idx
            self._current_index += 1

        # Should not reach here, but fallback
        idx = self._current_index % len(self._clients)
        return self._clients[idx], idx

    def _rotate_key(self, exhausted_index: int, is_daily_exhausted: bool = False):
        """Rotate to the next API key."""
        if is_daily_exhausted:
            self._exhausted_keys.add(exhausted_index)
        self._current_index = (exhausted_index + 1) % len(self._clients)
        next_idx = self._current_index
        remaining = len(self._clients) - len(self._exhausted_keys)
        print(f"[GeminiActor] Rotated from key {exhausted_index} → key {next_idx} "
              f"({remaining} keys remaining)")

    def call(
        self,
        prompt: str,
        max_tokens: int = 200,
        temperature: float = 0.7,
        model_name: str = "gemini-3-flash-preview",
        retries: int = 5,
    ) -> str:
        """
        Send a request to Gemini with retry, exponential backoff, and key rotation.

        When a key's daily quota is exhausted, automatically rotates to the
        next available key and retries without counting it as a failed attempt.
        """
        if not self._clients:
            return ""

        last_error = None
        attempt = 0
        while attempt < retries:
            client, key_idx = self._get_client()
            if client is None:
                return ""

            try:
                print(f"[GeminiActor] Attempt {attempt+1}/{retries} key={key_idx} calling {model_name}...")
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config={
                        "max_output_tokens": max_tokens,
                        "temperature": temperature,
                    },
                )

                if response.text:
                    print(f"[GeminiActor] Success! Response: {len(response.text)} chars (key={key_idx})")
                    return response.text
                else:
                    return ""

            except Exception as e:
                last_error = e
                if _is_rate_limit_error(e):
                    is_daily = _is_daily_quota_exhausted(e)

                    if is_daily or 'PerDay' in str(e):
                        # Daily quota exhausted — rotate to next key
                        print(f"[GeminiActor] Daily quota exhausted on key {key_idx}, rotating...")
                        self._rotate_key(key_idx, is_daily_exhausted=True)

                        # If we still have non-exhausted keys, retry immediately
                        # WITHOUT incrementing attempt counter
                        if len(self._exhausted_keys) < len(self._clients):
                            continue

                        # All keys exhausted
                        print(f"[GeminiActor] ALL {len(self._clients)} keys daily-exhausted. Giving up.")
                        break

                    # Per-minute rate limit — wait and retry with same key
                    api_delay = _parse_retry_delay(e)
                    wait_time = api_delay if api_delay else min(60, (2 ** attempt) + random.random() * 2)
                    print(f"Rate limit hit (attempt {attempt + 1}/{retries}), "
                          f"waiting {wait_time:.1f}s: {e}")
                    time.sleep(wait_time)
                    attempt += 1
                else:
                    # Non-rate-limit error: shorter backoff
                    wait_time = random.random() * (2 ** attempt)
                    print(f"LLM error (attempt {attempt + 1}/{retries}), "
                          f"waiting {wait_time:.1f}s: {e}")
                    if attempt < retries - 1:
                        time.sleep(wait_time)
                        attempt += 1
                    else:
                        raise e

        # All retries exhausted
        if last_error:
            raise last_error
        return ""


class GeminiLLM:
    """
    Manages a pool of GeminiActor Ray actors for parallel LLM requests.

    Inspired by AgentSociety's LLM class which creates multiple LLMActor
    instances and round-robins requests across them.

    Usage:
        llm = GeminiLLM(num_actors=2)
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

        self._actors = [GeminiActor.remote() for _ in range(num_actors)]
        self._next_index = 0
        self._lock = asyncio.Lock()
        logger.info(f"GeminiLLM initialized with {num_actors} actors")

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
        model_name: str = "gemini-3-flash-preview",
        retries: int = 5,
    ) -> str:
        """
        Async request to the LLM actor pool.

        Selects an actor via round-robin and sends the request.

        Args:
            prompt: The prompt to send
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            model_name: Gemini model to use
            retries: Number of retries

        Returns:
            Generated text response
        """
        async with self._lock:
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
        model_name: str = "gemini-3-flash-preview",
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
_llm_pool: Optional[GeminiLLM] = None


def get_llm_pool(num_actors: int = None) -> GeminiLLM:
    """Get or create the global LLM actor pool"""
    global _llm_pool
    if _llm_pool is None:
        _llm_pool = GeminiLLM(num_actors=num_actors)
    return _llm_pool


def shutdown_llm_pool():
    """Shutdown the global LLM pool"""
    global _llm_pool
    if _llm_pool is not None:
        _llm_pool.shutdown()
        _llm_pool = None


def configure_gemini(api_key: str = None):
    """
    Legacy compatibility — now a no-op since each GeminiActor
    reads GEMINI_API_KEY from its own environment.
    """
    if api_key:
        os.environ["GEMINI_API_KEY"] = api_key
    logger.info("Gemini configured (API key set in environment)")


def call_llm_sync(
    prompt: str,
    max_tokens: int = 200,
    temperature: float = 0.7,
    model_name: str = "gemini-3-flash-preview",
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
