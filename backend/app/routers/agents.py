"""
Custom Agent management routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database import get_db
from app.models import User, CustomAgent
from app.schemas import CustomAgentCreate, CustomAgentResponse
from app.dependencies import get_current_user

router = APIRouter(prefix="/agents", tags=["Custom Agents"])


@router.post("", response_model=CustomAgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    agent_data: CustomAgentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new custom agent
    """
    db_agent = CustomAgent(
        user_id=current_user.id,
        **agent_data.model_dump()
    )
    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)
    return db_agent


@router.get("", response_model=List[CustomAgentResponse])
async def list_agents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all custom agents for the current user
    """
    agents = db.query(CustomAgent).filter(CustomAgent.user_id == current_user.id).order_by(CustomAgent.created_at.desc()).all()
    return agents


@router.get("/{agent_id}", response_model=CustomAgentResponse)
async def get_agent(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific custom agent by ID
    """
    agent = db.query(CustomAgent).filter(
        CustomAgent.id == agent_id,
        CustomAgent.user_id == current_user.id
    ).first()
    
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
        
    return agent


@router.put("/{agent_id}", response_model=CustomAgentResponse)
async def update_agent(
    agent_id: UUID,
    agent_data: CustomAgentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a custom agent
    """
    agent = db.query(CustomAgent).filter(
        CustomAgent.id == agent_id,
        CustomAgent.user_id == current_user.id
    ).first()
    
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
        
    for key, value in agent_data.model_dump().items():
        setattr(agent, key, value)
        
    db.commit()
    db.refresh(agent)
    return agent


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a custom agent
    """
    agent = db.query(CustomAgent).filter(
        CustomAgent.id == agent_id,
        CustomAgent.user_id == current_user.id
    ).first()
    
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
        
    db.delete(agent)
    db.commit()
