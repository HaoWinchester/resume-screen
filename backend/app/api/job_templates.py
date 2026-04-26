from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any
import uuid

from app.database import get_db
from app.api.deps import get_current_user, User
from app.services.job_template_service import JobTemplateService
from app.schemas.job_template import (
    JobTemplateCreate,
    JobTemplateUpdate,
    JobTemplateResponse
)

router = APIRouter(prefix="/job-templates", tags=["job-templates"])


@router.get("", response_model=list[JobTemplateResponse])
async def list_job_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取公司岗位模板列表"""
    service = JobTemplateService(db)

    templates = await service.list(current_user.company_id)

    return [
        {
            "id": t.id,
            "name": t.name,
            "content": t.content,
            "created_by": t.created_by,
            "created_at": t.created_at,
            "updated_at": t.updated_at
        }
        for t in templates
    ]


@router.post("", response_model=JobTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_job_template(
    data: JobTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """创建模板"""
    service = JobTemplateService(db)

    template = await service.create(
        company_id=current_user.company_id,
        created_by=current_user.id,
        data=data
    )

    return {
        "id": template.id,
        "name": template.name,
        "content": template.content,
        "created_by": template.created_by,
        "created_at": template.created_at,
        "updated_at": template.updated_at
    }


@router.patch("/{template_id}", response_model=JobTemplateResponse)
async def update_job_template(
    template_id: uuid.UUID,
    data: JobTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """更新模板"""
    service = JobTemplateService(db)

    template = await service.update(template_id, current_user.company_id, data)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "模板不存在"}}
        )

    return {
        "id": template.id,
        "name": template.name,
        "content": template.content,
        "created_by": template.created_by,
        "created_at": template.created_at,
        "updated_at": template.updated_at
    }


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job_template(
    template_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """删除模板"""
    service = JobTemplateService(db)

    success = await service.delete(template_id, current_user.company_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "模板不存在"}}
        )
