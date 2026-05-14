from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import User, get_current_user
from app.database import get_db
from app.models import JobSkillOption
from app.schemas.job_skill_option import JobSkillOptionCreate, JobSkillOptionListResponse, JobSkillOptionResponse

router = APIRouter(prefix="/job-skill-options", tags=["job-skill-options"])


def _payload(option: JobSkillOption) -> JobSkillOptionResponse:
    return JobSkillOptionResponse(
        id=option.id,
        job_type=option.job_type,
        option_type=option.option_type,
        value=option.value,
        created_at=option.created_at,
    )


@router.get("", response_model=JobSkillOptionListResponse)
async def list_job_skill_options(
    job_type: str | None = Query(None, max_length=80),
    option_type: str | None = Query(None, pattern="^(required|bonus)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(JobSkillOption).where(
        JobSkillOption.company_id == current_user.company_id,
        JobSkillOption.user_id == current_user.id,
    )
    if job_type:
        query = query.where(JobSkillOption.job_type == job_type.strip())
    if option_type:
        query = query.where(JobSkillOption.option_type == option_type)

    result = await db.execute(query.order_by(JobSkillOption.created_at.desc()))
    return {"items": [_payload(item) for item in result.scalars().all()]}


@router.post("", response_model=JobSkillOptionResponse)
async def create_job_skill_option(
    payload: JobSkillOptionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JobSkillOption).where(
            JobSkillOption.company_id == current_user.company_id,
            JobSkillOption.user_id == current_user.id,
            JobSkillOption.job_type == payload.job_type,
            JobSkillOption.option_type == payload.option_type,
            JobSkillOption.value == payload.value,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return _payload(existing)

    option = JobSkillOption(
        company_id=current_user.company_id,
        user_id=current_user.id,
        job_type=payload.job_type,
        option_type=payload.option_type,
        value=payload.value,
    )
    db.add(option)
    await db.commit()
    await db.refresh(option)
    return _payload(option)
