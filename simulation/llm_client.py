"""
LLM client using Google Gemini with retry logic
Now using the new google.genai client API
"""
import os
import logging
from pathlib import Path
from typing import Optional
from google import genai
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# Load environment variables from .env file
from dotenv import load_dotenv
# Try to find .env in multiple locations
env_paths = [
    Path(__file__).parent.parent / ".env",  # project root
    Path(__file__).parent / ".env",  # simulation folder
    Path.cwd() / ".env",  # current working directory
]
for env_path in env_paths:
    if env_path.exists():
        load_dotenv(env_path)
        break

logger = logging.getLogger(__name__)

# Configure Gemini client
_client = None

def configure_gemini(api_key: str = None):
    """Configure Gemini API client"""
    global _client
    
    if _client is None:
        key = api_key or os.getenv("GEMINI_API_KEY")
        if key:
            _client = genai.Client(api_key=key)
            logger.info("Gemini API client configured")
        else:
            logger.warning("No Gemini API key provided")
    
    return _client


def get_client():
    """Get the configured Gemini client"""
    global _client
    if _client is None:
        configure_gemini()
    return _client


class GeminiRateLimitError(Exception):
    """Custom exception for rate limit errors"""
    pass


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((GeminiRateLimitError, ConnectionError)),
    reraise=True
)
async def call_llm(
    prompt: str,
    max_tokens: int = 200,
    temperature: float = 0.7,
    model_name: str = "gemini-3-flash-preview"
) -> str:
    """
    Call Gemini LLM with exponential backoff retry
    
    Args:
        prompt: The prompt to send
        max_tokens: Maximum tokens to generate
        temperature: Sampling temperature (0-1)
        model_name: Gemini model to use
    
    Returns:
        Generated text response
    """
    try:
        client = get_client()
        if client is None:
            return ""
        
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config={
                "max_output_tokens": max_tokens,
                "temperature": temperature
            }
        )
        
        if response.text:
            return response.text
        else:
            logger.warning("Empty response from Gemini")
            return ""
            
    except Exception as e:
        error_str = str(e).lower()
        
        if "rate" in error_str or "quota" in error_str:
            logger.warning(f"Rate limit hit, will retry: {e}")
            raise GeminiRateLimitError(str(e))
        
        logger.error(f"LLM call failed: {e}")
        raise


def _is_rate_limit_error(exception):
    """Check if exception is a rate limit error"""
    error_str = str(exception).lower()
    return any(x in error_str for x in ['rate', 'quota', '429', 'resource_exhausted'])


@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=10, max=60),
    retry=retry_if_exception_type((GeminiRateLimitError, ConnectionError)),
    reraise=True
)
def call_llm_sync(
    prompt: str,
    max_tokens: int = 200,
    temperature: float = 0.7,
    model_name: str = "gemini-3-flash-preview"
) -> str:
    """
    Synchronous version of call_llm with retry logic
    
    Handles Gemini free tier rate limits:
    - 10-15 RPM
    - Retries with exponential backoff (10-60s)
    """
    try:
        client = get_client()
        if client is None:
            logger.warning("No Gemini client available")
            return ""
        
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config={
                "max_output_tokens": max_tokens,
                "temperature": temperature
            }
        )
        
        if response.text:
            return response.text
        else:
            logger.warning("Empty response from Gemini")
            return ""
            
    except Exception as e:
        error_str = str(e).lower()
        
        # Check for rate limit errors and raise for retry
        if _is_rate_limit_error(e):
            logger.warning(f"Rate limit hit, will retry with backoff: {e}")
            raise GeminiRateLimitError(str(e))
        
        logger.error(f"LLM call failed: {e}")
        return ""
