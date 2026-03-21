"""
HuggingFace Bucket Storage Service
Uploads video files to the HuggingFace Bucket (Xet storage) and returns the public URL.

Bucket URL: https://huggingface.co/buckets/vish85521/videos
Requires: huggingface_hub >= 1.7.0 (for batch_bucket_files)
"""
import os
import logging

logger = logging.getLogger(__name__)


def _get_settings():
    from app.config import get_settings
    return get_settings()


def upload_video_to_hf(local_path: str, filename: str) -> str:
    """
    Upload a local video file to the HuggingFace Bucket.

    Args:
        local_path: Absolute path to the local video file.
        filename: Desired filename to use in the bucket (e.g. "uuid.mp4").

    Returns:
        Public download URL for the uploaded file.

    Raises:
        ValueError: If HF access token is not configured.
        Exception: If upload fails.
    """
    from huggingface_hub import batch_bucket_files

    settings = _get_settings()

    if not settings.hf_access_token:
        raise ValueError(
            "HF_ACCESS_TOKEN is not configured. "
            "Please set it in your .env file."
        )

    # bucket_id = owner/bucket-name  (e.g. "vish85521/videos")
    bucket_id = settings.hf_video_repo_id

    # remote path inside the bucket; use prefix subdir if set
    if settings.hf_video_path_prefix:
        remote_path = f"{settings.hf_video_path_prefix}/{filename}"
    else:
        remote_path = filename

    logger.info(f"Uploading {local_path} → bucket {bucket_id}/{remote_path} ...")

    batch_bucket_files(
        bucket_id=bucket_id,
        add=[(local_path, remote_path)],
        token=settings.hf_access_token,
    )

    # Public resolve URL for HF buckets:
    # https://huggingface.co/buckets/<bucket_id>/resolve/<remote_path>
    url = f"https://huggingface.co/buckets/{bucket_id}/resolve/{remote_path}"

    logger.info(f"Upload complete. Public URL: {url}")
    return url


def delete_video_from_hf(video_url: str) -> None:
    """
    Delete a video from the HuggingFace Bucket given its public URL.
    Silently ignores failures (e.g. file not found).

    Args:
        video_url: The public HF bucket resolve URL of the video.
    """
    from huggingface_hub import batch_bucket_files

    settings = _get_settings()

    if not settings.hf_access_token:
        logger.warning("HF_ACCESS_TOKEN not configured, skipping HF delete.")
        return

    # URL format: https://huggingface.co/buckets/<bucket_id>/resolve/<remote_path>
    marker = "/resolve/"
    if marker not in video_url:
        logger.warning(f"Cannot parse HF bucket URL for deletion: {video_url}")
        return

    # Extract bucket_id and remote_path from URL
    # e.g. https://huggingface.co/buckets/vish85521/videos/resolve/videos/uuid.mp4
    #   → parts after "buckets/" = "vish85521/videos/resolve/videos/uuid.mp4"
    try:
        after_buckets = video_url.split("/buckets/", 1)[1]
        # after_buckets = "vish85521/videos/resolve/videos/uuid.mp4"
        owner, rest = after_buckets.split("/", 1)
        bucket_name, path_part = rest.split("/resolve/", 1)
        bucket_id = f"{owner}/{bucket_name}"
        remote_path = path_part
    except (IndexError, ValueError) as e:
        logger.warning(f"Failed to parse HF URL '{video_url}': {e}")
        return

    try:
        batch_bucket_files(
            bucket_id=bucket_id,
            delete=[remote_path],
            token=settings.hf_access_token,
        )
        logger.info(f"Deleted HF bucket file: {bucket_id}/{remote_path}")
    except Exception as e:
        logger.warning(f"Failed to delete HF bucket file {remote_path}: {e}")
