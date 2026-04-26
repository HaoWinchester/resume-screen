from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.database import get_db
from app.api.deps import get_current_user, get_pagination_params, User
from app.services.job_requirement_service import JobRequirementService
from app.schemas.job_requirement import (
    JobRequirementCreate,
    JobRequirementUpdate,
    JobRequirementResponse,
    JobRequirementActivateResponse
)
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/job-requirements", tags=["job-requirements"])


@router.get("", response_model=PaginatedResponse[JobRequirementResponse])
async def list_job_requirements(
    status_filter: str = Query(None, description="Filter by status: draft, active, closed"),
    pagination: tuple[int, int] = Depends(get_pagination_params),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取当前公司的岗位需求列表

    - 支持按状态筛选
    - 支持分页
    """
    page, per_page = pagination
    service = JobRequirementService(db)

    items, total = await service.list(
        company_id=current_user.company_id,
        status_filter=status_filter,
        page=page,
        per_page=per_page
    )

    # Enrich with stats
    result_items = []
    for item in items:
        stats = await service.get_with_stats(item.id, current_user.company_id)
        result_items.append({
            "id": item.id,
            "title": item.title,
            "description": item.description,
            "status": item.status.value,
            "criteria": item.criteria,
            "created_by": item.created_by,
            "resume_count": stats["resume_count"] if stats else 0,
            "analyzed_count": stats["analyzed_count"] if stats else 0,
            "created_at": item.created_at,
            "updated_at": item.updated_at
        })

    return PaginatedResponse(
        items=result_items,
        total=total,
        page=page,
        per_page=per_page
    )


@router.post("", response_model=JobRequirementResponse, status_code=status.HTTP_201_CREATED)
async def create_job_requirement(
    data: JobRequirementCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    创建岗位需求

    - 可选择从模板创建
    - 默认状态为 draft
    """
    service = JobRequirementService(db)

    job = await service.create(
        company_id=current_user.company_id,
        created_by=current_user.id,
        data=data
    )

    return {
        "id": job.id,
        "title": job.title,
        "description": job.description,
        "status": job.status.value,
        "criteria": job.criteria,
        "created_by": job.created_by,
        "resume_count": 0,
        "analyzed_count": 0,
        "created_at": job.created_at,
        "updated_at": job.updated_at
    }


@router.get("/{job_id}", response_model=JobRequirementResponse)
async def get_job_requirement(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取单个岗位需求详情"""
    service = JobRequirementService(db)

    stats = await service.get_with_stats(job_id, current_user.company_id)
    if not stats:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "岗位需求不存在"}}
        )

    job = stats["job"]
    return {
        "id": job.id,
        "title": job.title,
        "description": job.description,
        "status": job.status.value,
        "criteria": job.criteria,
        "created_by": job.created_by,
        "resume_count": stats["resume_count"],
        "analyzed_count": stats["analyzed_count"],
        "created_at": job.created_at,
        "updated_at": job.updated_at
    }


@router.patch("/{job_id}", response_model=JobRequirementResponse)
async def update_job_requirement(
    job_id: uuid.UUID,
    data: JobRequirementUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    更新岗位需求

    - 仅 draft 和 active 状态可更新
    - 支持部分更新
    """
    service = JobRequirementService(db)

    job = await service.update(job_id, current_user.company_id, data)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "岗位需求不存在"}}
        )

    stats = await service.get_with_stats(job_id, current_user.company_id)
    return {
        "id": job.id,
        "title": job.title,
        "description": job.description,
        "status": job.status.value,
        "criteria": job.criteria,
        "created_by": job.created_by,
        "resume_count": stats["resume_count"] if stats else 0,
        "analyzed_count": stats["analyzed_count"] if stats else 0,
        "created_at": job.created_at,
        "updated_at": job.updated_at
    }


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job_requirement(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    删除岗位需求

    - 仅 draft 状态可删除
    """
    service = JobRequirementService(db)

    success = await service.delete(job_id, current_user.company_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "CANNOT_DELETE", "message": "无法删除该岗位需求（仅 draft 状态可删除）"}}
        )


@router.post("/{job_id}/activate", response_model=JobRequirementActivateResponse)
async def activate_job_requirement(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    激活岗位需求

    - 校验 criteria 非空
    """
    service = JobRequirementService(db)

    try:
        job = await service.activate(job_id, current_user.company_id)
    except ValueError as e:
        if str(e) == "EMPTY_CRITERIA":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error": {"code": "EMPTY_CRITERIA", "message": "激活失败：筛选条件不能为空"}}
            )
        raise

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "岗位需求不存在"}}
        )

    return {
        "id": job.id,
        "status": job.status.value
    }


@router.post("/{job_id}/close", response_model=JobRequirementActivateResponse)
async def close_job_requirement(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """关闭岗位需求"""
    service = JobRequirementService(db)

    job = await service.close(job_id, current_user.company_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "岗位需求不存在"}}
        )

    return {
        "id": job.id,
        "status": job.status.value
    }


@router.post("/{job_id}/copy", response_model=JobRequirementResponse)
async def copy_job_requirement(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """复制岗位需求"""
    service = JobRequirementService(db)

    job = await service.copy(job_id, current_user.company_id, current_user.id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "岗位需求不存在"}}
        )

    return {
        "id": job.id,
        "title": job.title,
        "description": job.description,
        "status": job.status.value,
        "criteria": job.criteria,
        "created_by": job.created_by,
        "resume_count": 0,
        "analyzed_count": 0,
        "created_at": job.created_at,
        "updated_at": job.updated_at
    }
