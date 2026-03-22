"""
Video processing service using Google Gemini Files API
Uploads entire video instead of extracting frames for better analysis
"""
import os
import time
import logging
import tempfile
from typing import Tuple
from google import genai
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# Configure Gemini client
_client = None
_key_index = 0

def get_client():
    """Get or create Gemini client"""
    global _client, _key_index
    
    _client = None  # Always reset to ensure fresh client on next call
    
    key_list = []
    if getattr(settings, 'gemini_api_keys', None):
        key_list = [k.strip() for k in settings.gemini_api_keys.split(',') if k.strip()]
        
    if len(key_list) > 1:
        current_key = key_list[_key_index % len(key_list)]
        _key_index += 1
        _client = genai.Client(api_key=current_key)
    else:
        _client = genai.Client(api_key=settings.gemini_api_key)
        
    return _client


def _resolve_video_path(video_path: str) -> Tuple[str, bool]:
    """
    If video_path is an HF bucket URL, download it to a local temp file.

    Returns:
        (local_path, is_temp) — is_temp=True means the caller must delete the file.
    """
    video_path = video_path.strip()

    if not video_path.startswith("http://") and not video_path.startswith("https://"):
        return video_path, False  # already a local path

    logger.info(f"Downloading video from URL: {video_path}")
    import requests

    headers = {}
    if settings.hf_access_token:
        headers["Authorization"] = f"Bearer {settings.hf_access_token}"

    resp = requests.get(video_path, headers=headers, timeout=300, stream=True)
    resp.raise_for_status()

    # Detect extension from URL (strip query params first)
    ext = os.path.splitext(video_path.split("?")[0])[1] or ".mp4"

    tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
    try:
        for chunk in resp.iter_content(chunk_size=4 * 1024 * 1024):
            if chunk:
                tmp.write(chunk)
        tmp.flush()
        tmp_path = tmp.name
    finally:
        tmp.close()

    logger.info(f"Downloaded video to temp file: {tmp_path}")
    return tmp_path, True


def get_video_duration_cv2(video_path: str) -> int:
    """Get video duration in seconds using OpenCV"""
    try:
        import cv2
        video = cv2.VideoCapture(video_path)
        fps = video.get(cv2.CAP_PROP_FPS)
        frame_count = video.get(cv2.CAP_PROP_FRAME_COUNT)
        video.release()
        
        if fps > 0:
            return int(frame_count / fps)
    except Exception as e:
        logger.warning(f"Could not get video duration: {e}")
    return 0


def analyze_video_with_gemini(video_path: str) -> str:
    """
    Analyze video using Gemini Files API
    
    This uploads the entire video file to Gemini for comprehensive analysis,
    which provides better context than frame extraction.
    
    Args:
        video_path: Local path to video file or remote URL
    
    Returns:
        Scene descriptions and analysis
    """
    local_path = None
    is_temp = False
    try:
        client = get_client()

        # Accept URL inputs as well (defensive path for direct callers).
        local_path, is_temp = _resolve_video_path(video_path)

        # Step 1: Upload video to Gemini
        logger.info(f"Uploading video to Gemini: {local_path}")
        uploaded_file = client.files.upload(file=local_path)
        logger.info(f"Uploaded file: {uploaded_file.name}")
        
        # Step 2: Wait for processing (videos need processing time)
        max_wait = 120  # Maximum 2 minutes wait
        wait_time = 0
        
        while uploaded_file.state == "PROCESSING":
            if wait_time >= max_wait:
                logger.error("Video processing timeout")
                return "Video processing timeout. Please try with a shorter video."
            
            logger.info(f"Waiting for video processing... ({wait_time}s)")
            time.sleep(10)
            wait_time += 10
            uploaded_file = client.files.get(name=uploaded_file.name)
        
        if uploaded_file.state == "FAILED":
            logger.error("Video processing failed on Gemini side")
            return "Video processing failed. Please try a different video format."
        
        logger.info("Video processing complete, analyzing content...")
        
        # Step 3: Analyze with Gemini
        prompt = """Watch this video advertisement and transcribe everything you observe into detailed plain text.
Do not interpret, judge, or analyse. Only describe what you literally see and hear.

Describe the following:

1. SCENES: For each scene or shot, describe what is visible — people, objects, setting, actions, movement.

2. PEOPLE: Physical appearance, approximate age, gender, clothing, any visible religious or cultural markers (e.g. clothing style, jewellery, head coverings).

3. TEXT ON SCREEN: Transcribe every word of text, slogans, logos, or captions that appear. Note the language.

4. AUDIO (if detectable): Any spoken words, voiceover lines, song lyrics, or notable sounds.

5. PRODUCT / BRAND: What product or service is being advertised? What is shown of it?

6. SETTING: Where does the ad take place? Indoor/outdoor, urban/rural, home/workplace/public space, any recognisable locations.

7. SEQUENCE: Briefly describe the order of events — what happens first, then next, then last.

Be exhaustive and literal. Do not use words like 'suggests', 'implies', 'appears to target', or 'may offend'.
Only state what is directly visible or audible. Write in plain paragraphs."""

        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=[uploaded_file, prompt]
        )
        
        # Step 4: Clean up uploaded file (optional - files expire automatically)
        try:
            client.files.delete(name=uploaded_file.name)
            logger.info("Cleaned up uploaded video file")
        except:
            pass  # File cleanup is optional
        
        if response.text:
            logger.info(f"Generated analysis: {len(response.text)} characters")
            return response.text
        else:
            return "No analysis could be generated for this video."
        
    except Exception as e:
        logger.error(f"Gemini video analysis failed: {e}")
        return f"Video analysis failed: {str(e)}"
    finally:
        if is_temp and local_path and os.path.exists(local_path):
            os.remove(local_path)
            logger.info(f"Removed temp video file: {local_path}")


def process_video(video_path: str) -> Tuple[str, int]:
    """
    Full video processing pipeline using Gemini Files API

    Args:
        video_path: Local file path OR remote HF bucket URL.

    Returns:
        Tuple of (scene_descriptions, duration_seconds)
    """
    logger.info(f"Processing video: {video_path}")

    local_path, is_temp = _resolve_video_path(video_path)
    try:
        # Get duration
        duration = get_video_duration_cv2(local_path)

        # Analyze with Gemini Files API
        descriptions = analyze_video_with_gemini(local_path)
    finally:
        if is_temp and os.path.exists(local_path):
            os.remove(local_path)
            logger.info(f"Removed temp video file: {local_path}")

    return descriptions, duration
