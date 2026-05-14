from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import User, get_current_user
from app.database import get_db
from app.schemas.agent_run import AgentRunCreate, AgentRunItem, AgentRunListResponse
from app.services.agent_runtime_service import AgentRuntimeService
from app.services.task_dispatcher import dispatch_agent_run

router = APIRouter(prefix="/agent-runs", tags=["agent-runs"])


@router.post("", response_model=AgentRunItem)
async def create_agent_run(
    payload: AgentRunCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AgentRuntimeService(db)
    try:
        run = await service.create_run(
            current_user=current_user,
            task_type=payload.task_type,
            target_type=payload.target_type,
            target_id=payload.target_id,
            task_prompt=payload.task_prompt,
            context=payload.context,
        )
        if payload.run_async:
            dispatch_agent_run(str(run.id))
            run = await service.get_company_run(current_user.company_id, run.id) or run
        else:
            run = await service.execute_run(run.id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "AGENT_RUN_INVALID", "message": str(exc)}},
        ) from exc

    return run


@router.get("", response_model=AgentRunListResponse)
async def list_agent_runs(
    target_type: str | None = Query(default=None),
    target_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AgentRuntimeService(db)
    runs = await service.list_runs(
        company_id=current_user.company_id,
        target_type=target_type,
        target_id=target_id,
        limit=limit,
    )
    return {"items": runs}


@router.get("/{run_id}", response_model=AgentRunItem)
async def get_agent_run(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AgentRuntimeService(db)
    run = await service.get_company_run(current_user.company_id, run_id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "Agent run 不存在"}},
        )
    return run
