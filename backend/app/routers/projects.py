"""
Project management routes - create, list, and get projects
"""
import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import User, Project
from app.schemas import ProjectCreate, ProjectResponse, ProjectListResponse
from app.dependencies import get_current_user
from app.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/projects", tags=["Projects"])

# Allowed video extensions
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".webm", ".mkv"}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    title: str = Form(...),
    demographic_filter: Optional[str] = Form(None),
    video: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new project with video upload
    """
    # Validate file extension
    file_ext = os.path.splitext(video.filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Create upload directory if it doesn't exist
    upload_dir = os.path.join(settings.upload_dir, str(current_user.id))
    os.makedirs(upload_dir, exist_ok=True)
    
    # Generate unique filename
    file_id = str(uuid.uuid4())
    filename = f"{file_id}{file_ext}"
    file_path = os.path.join(upload_dir, filename)
    
    # Save file
    try:
        async with aiofiles.open(file_path, 'wb') as f:
            # Read in chunks to handle large files
            total_size = 0
            while chunk := await video.read(1024 * 1024):  # 1MB chunks
                total_size += len(chunk)
                if total_size > MAX_FILE_SIZE:
                    os.remove(file_path)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB"
                    )
                await f.write(chunk)
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )
    
    # Parse demographic filter
    demo_filter = None
    if demographic_filter:
        import json
        try:
            demo_filter = json.loads(demographic_filter)
        except json.JSONDecodeError:
            pass
    
    # Create project record
    project = Project(
        user_id=current_user.id,
        title=title,
        video_path=file_path,
        demographic_filter=demo_filter,
        status="PENDING"
    )
    
    db.add(project)
    db.commit()
    db.refresh(project)
    
    # Queue VLM processing task (async)
    from app.tasks import process_video_task
    process_video_task.delay(str(project.id))
    
    return project


@router.get("/", response_model=List[ProjectListResponse])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all projects for the current user
    """
    projects = db.query(Project).filter(
        Project.user_id == current_user.id
    ).order_by(Project.created_at.desc()).all()
    
    return projects


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific project by ID
    """
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a project and its video file
    """
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Delete video file
    if os.path.exists(project.video_path):
        os.remove(project.video_path)
    
    # Delete project record
    db.delete(project)
    db.commit()
