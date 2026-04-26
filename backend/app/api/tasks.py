from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import uuid
from datetime import datetime

from app.database import get_db
from app.api.deps import get_current_user, User
from app.models import Resume, ParseStatus, AnalysisResult, AnalysisStatus

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/{task_id}")
async def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取异步任务进度

    Note: This is a simplified implementation. In production, you would use
    Celery's result backend to get real-time task status.
    """
    # For now, we'll estimate progress based on the job requirement's resumes
    # This assumes task_id contains job_requirement_id
    try:
        job_requirement_id = uuid.UUID(task_id)
    except ValueError:
        # Try to parse as resume_id
        try:
            resume_id = uuid.UUID(task_id)
            # Get single resume status
            result = await db.execute(
                select(Resume).where(Resume.id == resume_id)
            )
            resume = result.scalar_one_or_none()

            if not resume:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"error": {"code": "NOT_FOUND", "message": "任务不存在"}}
                )

            # Determine status based on parse and analysis status
            task_status = "pending"
            if resume.parse_status == ParseStatus.PARSING:
                task_status = "in_progress"
            elif resume.parse_status == ParseStatus.SUCCESS:
                result = await db.execute(
                    select(AnalysisResult).where(AnalysisResult.resume_id == resume_id)
                )
                analysis = result.scalar_one_or_none()
                if analysis:
                    if analysis.analysis_status == AnalysisStatus.ANALYZING:
                        task_status = "in_progress"
                    elif analysis.analysis_status == AnalysisStatus.COMPLETED:
                        task_status = "completed"
                    elif analysis.analysis_status == AnalysisStatus.FAILED:
                        task_status = "failed"
            elif resume.parse_status == ParseStatus.FAILED:
                task_status = "failed"

            return {
                "task_id": task_id,
                "type": "resume_analysis",
                "status": task_status,
                "progress": {
                    "total": 1,
                    "completed": 1 if task_status == "completed" else 0,
                    "failed": 1 if task_status == "failed" else 0
                },
                "created_at": resume.created_at
            }

        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": {"code": "NOT_FOUND", "message": "任务不存在"}}
            )

    # Get job requirement stats
    from app.models import JobRequirement
    result = await db.execute(
        select(JobRequirement).where(
            JobRequirement.id == job_requirement_id,
            JobRequirement.company_id == current_user.company_id
        )
    )
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "任务不存在"}}
        )

    # Get resume counts by status
    total_result = await db.execute(
        select(func.count()).select_from(Resume).where(
            Resume.job_requirement_id == job_requirement_id
        )
    )
    total = total_result.scalar() or 0

    completed_result = await db.execute(
        select(func.count())
        .select_from(Resume)
        .join(AnalysisResult, Resume.id == AnalysisResult.resume_id)
        .where(
            Resume.job_requirement_id == job_requirement_id,
            AnalysisResult.analysis_status == AnalysisStatus.COMPLETED
        )
    )
    completed = completed_result.scalar() or 0

    failed_result = await db.execute(
        select(func.count())
        .select_from(Resume)
        .where(
            Resume.job_requirement_id == job_requirement_id,
            Resume.parse_status == ParseStatus.FAILED
        )
    )
    failed_parse = failed_result.scalar() or 0

    failed_analysis_result = await db.execute(
        select(func.count())
        .select_from(AnalysisResult)
        .join(Resume, AnalysisResult.resume_id == Resume.id)
        .where(
            Resume.job_requirement_id == job_requirement_id,
            AnalysisResult.analysis_status == AnalysisStatus.FAILED
        )
    )
    failed_analysis = failed_analysis_result.scalar() or 0

    total_failed = failed_parse + failed_analysis

    # Determine overall status
    task_status = "pending"
    if completed > 0 or total_failed > 0:
        if completed + total_failed >= total:
            task_status = "completed"
        else:
            task_status = "in_progress"

    return {
        "task_id": task_id,
        "type": "resume_analysis",
        "status": task_status,
        "progress": {
            "total": total,
            "completed": completed,
            "failed": total_failed
        },
        "created_at": job.created_at
    }
