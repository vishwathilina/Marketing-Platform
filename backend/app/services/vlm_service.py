"""
Video processing service using Google Gemini for frame analysis
Now using the new google.genai client API
"""
import os
import cv2
import base64
import tempfile
import logging
from typing import List, Tuple
from google import genai
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# Configure Gemini client
_client = None

def get_client():
    """Get or create Gemini client"""
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def extract_frames(video_path: str, fps: int = 1, max_frames: int = 30) -> List[str]:
    """
    Extract frames from video at specified FPS
    
    Args:
        video_path: Local path to video file
        fps: Frames per second to extract (default 1 = 1 frame/second)
        max_frames: Maximum number of frames to extract
    
    Returns:
        List of paths to extracted frame images
    """
    video = cv2.VideoCapture(video_path)
    video_fps = video.get(cv2.CAP_PROP_FPS)
    
    if video_fps == 0:
        logger.error(f"Could not read video FPS: {video_path}")
        return []
    
    frame_interval = max(1, int(video_fps / fps))
    
    frame_paths = []
    frame_count = 0
    saved_count = 0
    
    temp_dir = tempfile.mkdtemp(prefix="agent_frames_")
    
    while saved_count < max_frames:
        success, frame = video.read()
        if not success:
            break
        
        if frame_count % frame_interval == 0:
            frame_path = os.path.join(temp_dir, f"frame_{saved_count:04d}.jpg")
            cv2.imwrite(frame_path, frame)
            frame_paths.append(frame_path)
            saved_count += 1
        
        frame_count += 1
    
    video.release()
    logger.info(f"Extracted {len(frame_paths)} frames from {video_path}")
    
    return frame_paths


def get_video_duration(video_path: str) -> int:
    """Get video duration in seconds"""
    video = cv2.VideoCapture(video_path)
    fps = video.get(cv2.CAP_PROP_FPS)
    frame_count = video.get(cv2.CAP_PROP_FRAME_COUNT)
    video.release()
    
    if fps > 0:
        return int(frame_count / fps)
    return 0


def encode_frame_to_base64(frame_path: str) -> str:
    """Encode an image file to base64"""
    with open(frame_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def analyze_frames_with_gemini(frame_paths: List[str]) -> str:
    """
    Analyze video frames using Gemini Vision
    
    Args:
        frame_paths: List of paths to frame images
    
    Returns:
        Combined scene descriptions
    """
    if not frame_paths:
        return "No frames could be extracted from the video."
    
    try:
        client = get_client()
        
        scene_descriptions = []
        
        # Analyze frames in batches
        batch_size = 5
        for i in range(0, len(frame_paths), batch_size):
            batch = frame_paths[i:i + batch_size]
            
            # Prepare images for Gemini - use file uploads
            parts = []
            
            # Add the prompt first
            prompt = """Analyze these frames from a video advertisement. For each distinct scene, describe:
1. People present and their relationships (age, gender, roles)
2. Cultural elements, symbols, or traditions shown
3. Actions and interactions between people
4. Tone and mood (formal, casual, happy, serious)
5. Any potentially controversial or sensitive elements

Be specific and detailed. Focus on elements that could affect how different demographic groups might react to this advertisement."""
            
            parts.append(prompt)
            
            # Add images as base64
            for frame_path in batch:
                with open(frame_path, "rb") as f:
                    image_data = f.read()
                parts.append({
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": base64.b64encode(image_data).decode("utf-8")
                    }
                })
            
            # Send to Gemini using new API - using 2.0-flash which is more stable
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=parts
            )
            
            scene_num = i // batch_size + 1
            scene_descriptions.append(f"Scenes {scene_num}:\n{response.text}")
        
        # Cleanup temp files
        for frame_path in frame_paths:
            try:
                os.remove(frame_path)
            except:
                pass
        
        combined = "\n\n".join(scene_descriptions)
        logger.info(f"Generated scene descriptions: {len(combined)} characters")
        
        return combined
        
    except Exception as e:
        logger.error(f"Gemini analysis failed: {e}")
        return f"Video analysis failed: {str(e)}"


def process_video(video_path: str) -> Tuple[str, int]:
    """
    Full video processing pipeline
    
    Args:
        video_path: Path to video file
    
    Returns:
        Tuple of (scene_descriptions, duration_seconds)
    """
    logger.info(f"Processing video: {video_path}")
    
    # Get duration
    duration = get_video_duration(video_path)
    
    # Extract frames
    frames = extract_frames(video_path, fps=1, max_frames=20)
    
    # Analyze with Gemini
    descriptions = analyze_frames_with_gemini(frames)
    
    return descriptions, duration
