"""
Hugging Face Storage Service
Uploads video files to a Hugging Face repo and returns a public URL.
"""
import os
import logging

logger = logging.getLogger(__name__)


def _get_settings():
    from app.config import get_settings
    return get_settings()


def _clean_token(token: str) -> str:
    """Normalize secrets loaded from env/space settings (remove trailing newlines/spaces)."""
    return (token or "").strip()


def _clean_path_prefix(prefix: str) -> str:
    """Normalize optional repo path prefix and handle legacy placeholder value."""
    cleaned = (prefix or "").strip().strip("/")
    if cleaned.upper() == "HF_VIDEO_PATH_PREFIX":
        return "videos"
    return cleaned


def _build_public_url(repo_id: str, repo_type: str, remote_path: str) -> str:
    repo_type = (repo_type or "dataset").lower()
    if repo_type == "dataset":
        return f"https://huggingface.co/datasets/{repo_id}/resolve/main/{remote_path}"
    if repo_type == "space":
        return f"https://huggingface.co/spaces/{repo_id}/resolve/main/{remote_path}"
    return f"https://huggingface.co/{repo_id}/resolve/main/{remote_path}"


def _extract_remote_path_from_url(video_url: str, repo_id: str, repo_type: str) -> str | None:
    patterns = []
    repo_type = (repo_type or "dataset").lower()

    if repo_type == "dataset":
        patterns.append(f"/datasets/{repo_id}/resolve/main/")
    elif repo_type == "space":
        patterns.append(f"/spaces/{repo_id}/resolve/main/")
    else:
        patterns.append(f"/{repo_id}/resolve/main/")

    # Backward compatibility for previously stored bucket URLs.
    patterns.append(f"/buckets/{repo_id}/resolve/")

    for marker in patterns:
        if marker in video_url:
            return video_url.split(marker, 1)[1]
    return None


def _ensure_repo_exists(api, repo_id: str, repo_type: str, token: str) -> None:
    """Ensure target repo exists; create it if missing."""
    from huggingface_hub.utils import RepositoryNotFoundError

    try:
        api.repo_info(repo_id=repo_id, repo_type=repo_type, token=token)
    except RepositoryNotFoundError:
        logger.warning(
            "HF repo not found (%s/%s). Creating it automatically.",
            repo_type,
            repo_id,
        )
        api.create_repo(
            repo_id=repo_id,
            repo_type=repo_type,
            token=token,
            private=False,
            exist_ok=True,
        )


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
    from huggingface_hub import HfApi

    settings = _get_settings()
    token = _clean_token(settings.hf_access_token)

    if not token:
        raise ValueError(
            "HF_ACCESS_TOKEN is not configured. "
            "Please set it in your .env file."
        )

    repo_id = settings.hf_video_repo_id
    repo_type = settings.hf_video_repo_type or "dataset"

    # remote path inside the bucket; use prefix subdir if set
    path_prefix = _clean_path_prefix(settings.hf_video_path_prefix)
    if path_prefix:
        remote_path = f"{path_prefix}/{filename}"
    else:
        remote_path = filename

    logger.info(f"Uploading {local_path} -> {repo_type} repo {repo_id}/{remote_path} ...")

    api = HfApi(token=token)
    _ensure_repo_exists(api=api, repo_id=repo_id, repo_type=repo_type, token=token)
    api.upload_file(
        path_or_fileobj=local_path,
        path_in_repo=remote_path,
        repo_id=repo_id,
        repo_type=repo_type,
        token=token,
    )

    url = _build_public_url(repo_id=repo_id, repo_type=repo_type, remote_path=remote_path)

    logger.info(f"Upload complete. Public URL: {url}")
    return url


def delete_video_from_hf(video_url: str) -> None:
    """
    Delete a video from the HuggingFace Bucket given its public URL.
    Silently ignores failures (e.g. file not found).

    Args:
        video_url: The public HF bucket resolve URL of the video.
    """
    from huggingface_hub import HfApi

    settings = _get_settings()
    token = _clean_token(settings.hf_access_token)

    if not token:
        logger.warning("HF_ACCESS_TOKEN not configured, skipping HF delete.")
        return

    repo_id = settings.hf_video_repo_id
    repo_type = settings.hf_video_repo_type or "dataset"
    remote_path = _extract_remote_path_from_url(video_url, repo_id=repo_id, repo_type=repo_type)
    if not remote_path:
        logger.warning(f"Cannot parse HF URL for deletion: {video_url}")
        return

    try:
        api = HfApi(token=token)
        api.delete_file(
            path_in_repo=remote_path,
            repo_id=repo_id,
            repo_type=repo_type,
            token=token,
        )
        logger.info(f"Deleted HF file: {repo_id}/{remote_path}")
    except Exception as e:
        logger.warning(f"Failed to delete HF file {remote_path}: {e}")
