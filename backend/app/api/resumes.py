from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone
import uuid

from app.database import get_db
from app.api.deps import get_current_user, get_pagination_params, User
from app.models import Resume, ResumeFileType, ParseStatus, JobRequirement, JobRequirementStatus
from app.services.storage_service import StorageService
from app.services.task_dispatcher import dispatch_resume_parse
from app.services.resume_display import get_resume_basic_info, get_display_parsed_data
from app.schemas.resume import (
    ResumeUploadResponse,
    ResumeUploadResult,
    ResumeUploadFailed,
    ResumeListResponse,
    ResumeListItem,
    ResumeDetail
)
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/resumes", tags=["resumes"])


@router.post("/upload", response_model=ResumeUploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_resumes(
    job_requirement_id: uuid.UUID = Form(...),
    files: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    批量上传简历文件

    - 支持格式: PDF, DOC, DOCX, JPG, PNG
    - 最多 100 个文件
    - 每个文件最大 20MB
    - 仅 active 状态的岗位可上传
    """
    # Validate job requirement
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
            detail={"error": {"code": "NOT_FOUND", "message": "岗位需求不存在"}}
        )

    if job.status != JobRequirementStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "INVALID_JOB_STATUS", "message": "仅活跃状态的岗位可上传简历"}}
        )

    # Validate file count
    if len(files) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "TOO_MANY_FILES", "message": "最多支持100个文件"}}
        )

    storage_service = StorageService()
    uploaded = []
    failed = []

    for file in files:
        try:
            # Determine file type
            is_valid, ext, error_msg = storage_service.validate_file(file)
            if not is_valid:
                failed.append({
                    "file_name": file.filename or "unknown",
                    "error": error_msg
                })
                continue

            # Map extension to file type enum
            file_type_map = {
                ".pdf": ResumeFileType.PDF,
                ".doc": ResumeFileType.DOC,
                ".docx": ResumeFileType.DOCX,
                ".jpg": ResumeFileType.JPG,
                ".jpeg": ResumeFileType.JPG,
                ".png": ResumeFileType.PNG
            }
            file_type = file_type_map.get(ext, ResumeFileType.PDF)

            # Create resume record
            resume_id = uuid.uuid4()
            resume = Resume(
                id=resume_id,
                job_requirement_id=job_requirement_id,
                file_name=file.filename,
                file_path="",  # Will be updated after save
                file_type=file_type.value,
                file_size=0,  # Will be updated after save
                parse_status=ParseStatus.PENDING,
                uploaded_by=current_user.id
            )
            db.add(resume)
            await db.flush()

            # Save file
            file_path, _, file_size = await storage_service.save_file(
                file, current_user.company_id, job_requirement_id, resume_id
            )

            # Update resume with file info
            resume.file_path = file_path
            resume.file_size = file_size

            # Create empty analysis result
            from app.models import AnalysisResult, AnalysisStatus
            analysis = AnalysisResult(
                resume_id=resume_id,
                job_requirement_id=job_requirement_id,
                overall_score=0.0,
                recommendation="pending",
                analysis_status=AnalysisStatus.PENDING
            )
            db.add(analysis)

            await db.commit()
            await db.refresh(resume)

            # Trigger parse task
            dispatch_resume_parse(str(resume_id), file_path, file_type.value)

            uploaded.append({
                "id": resume_id,
                "file_name": file.filename,
                "parse_status": "pending"
            })

        except HTTPException:
            raise
        except Exception as e:
            failed.append({
                "file_name": file.filename or "unknown",
                "error": str(e)
            })

    return {
        "job_requirement_id": job_requirement_id,
        "uploaded": uploaded,
        "failed": failed,
        "total_uploaded": len(uploaded),
        "total_failed": len(failed)
    }


@router.get("", response_model=PaginatedResponse[ResumeListItem])
async def list_resumes(
    job_requirement_id: uuid.UUID | None = Query(None, description="岗位需求ID，不传则返回当前公司全部简历"),
    parse_status: str = Query(None, description="解析状态筛选"),
    pagination: tuple[int, int] = Depends(get_pagination_params),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取简历列表

    - 默认返回当前公司全部简历
    - 可按岗位需求筛选
    - 按解析状态筛选
    - 支持分页
    """
    page, per_page = pagination
    status_filter: ParseStatus | None = None
    if parse_status:
        try:
            status_filter = ParseStatus(parse_status.lower())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error": {"code": "INVALID_PARSE_STATUS", "message": "解析状态不合法"}}
            )

    if job_requirement_id:
        # Verify job requirement belongs to user's company
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
                detail={"error": {"code": "NOT_FOUND", "message": "岗位需求不存在"}}
            )

    query = (
        select(Resume, JobRequirement.title)
        .join(JobRequirement, Resume.job_requirement_id == JobRequirement.id)
        .where(JobRequirement.company_id == current_user.company_id)
    )
    count_query = (
        select(func.count())
        .select_from(Resume)
        .join(JobRequirement, Resume.job_requirement_id == JobRequirement.id)
        .where(JobRequirement.company_id == current_user.company_id)
    )

    if job_requirement_id:
        query = query.where(Resume.job_requirement_id == job_requirement_id)
        count_query = count_query.where(Resume.job_requirement_id == job_requirement_id)

    if status_filter:
        query = query.where(Resume.parse_status == status_filter)
        count_query = count_query.where(Resume.parse_status == status_filter)

    query = (
        query
        .order_by(Resume.updated_at.desc(), Resume.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await db.execute(query)
    rows = result.all()

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    response_items = []
    for item, job_title in rows:
        basic_info = get_resume_basic_info(item)
        response_items.append({
            "id": item.id,
            "job_requirement_id": item.job_requirement_id,
            "job_title": job_title,
            "file_name": item.file_name,
            "parse_status": item.parse_status.value,
            "candidate_name": basic_info.get("name"),
            "candidate_email": basic_info.get("email"),
            "candidate_phone": basic_info.get("phone"),
            "created_at": item.created_at,
            "updated_at": item.updated_at,
        })

    return PaginatedResponse(
        items=response_items,
        total=total,
        page=page,
        per_page=per_page
    )


@router.post("/retry-pending", status_code=status.HTTP_202_ACCEPTED)
async def retry_pending_resumes(
    job_requirement_id: uuid.UUID | None = Query(None, description="岗位需求ID，不传则处理当前公司全部等待解析简历"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """批量重新解析当前公司等待中或卡在解析中的简历。"""
    from sqlalchemy import and_
    from app.models import AnalysisResult, AnalysisStatus, RecommendationLevel, DimensionScore

    if job_requirement_id:
        job_result = await db.execute(
            select(JobRequirement).where(
                JobRequirement.id == job_requirement_id,
                JobRequirement.company_id == current_user.company_id
            )
        )
        if not job_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": {"code": "NOT_FOUND", "message": "岗位需求不存在"}}
            )

    query = (
        select(Resume)
        .join(JobRequirement, Resume.job_requirement_id == JobRequirement.id)
        .where(
            and_(
                JobRequirement.company_id == current_user.company_id,
                Resume.parse_status.in_([ParseStatus.PENDING, ParseStatus.PARSING]),
            )
        )
        .order_by(Resume.created_at.desc())
        .limit(200)
    )
    if job_requirement_id:
        query = query.where(Resume.job_requirement_id == job_requirement_id)

    result = await db.execute(query)
    resumes = result.scalars().all()
    dispatched: list[Resume] = []

    for resume in resumes:
        now = datetime.now(timezone.utc)
        analysis_result = await db.execute(
            select(AnalysisResult).where(AnalysisResult.resume_id == resume.id)
        )
        analysis = analysis_result.scalar_one_or_none()

        resume.parse_status = ParseStatus.PENDING
        resume.parse_error = None
        resume.parsed_data = None
        resume.candidate_name = None
        resume.candidate_email = None
        resume.candidate_phone = None
        resume.updated_at = now

        if analysis:
            analysis.analysis_status = AnalysisStatus.PENDING
            analysis.overall_score = 0.0
            analysis.recommendation = RecommendationLevel.PENDING
            analysis.recommendation_reason = None
            analysis.strengths = None
            analysis.weaknesses = None
            analysis.analyzed_at = None

            old_scores = await db.execute(
                select(DimensionScore).where(DimensionScore.analysis_id == analysis.id)
            )
            for score in old_scores.scalars().all():
                await db.delete(score)

        dispatched.append(resume)

    await db.commit()

    for resume in dispatched:
        dispatch_resume_parse(str(resume.id), resume.file_path, resume.file_type.value)

    return {
        "retried": len(dispatched),
        "scope": str(job_requirement_id) if job_requirement_id else "all",
        "message": f"已重新提交 {len(dispatched)} 份等待解析的简历"
    }


@router.get("/{resume_id}", response_model=ResumeDetail)
async def get_resume_detail(
    resume_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取简历详情（含解析数据）"""
    from sqlalchemy import and_

    result = await db.execute(
        select(Resume, JobRequirement.title)
        .join(JobRequirement, Resume.job_requirement_id == JobRequirement.id)
        .where(
            and_(
                Resume.id == resume_id,
                JobRequirement.company_id == current_user.company_id
            )
        )
    )
    row = result.one_or_none()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "简历不存在"}}
        )

    resume, job_title = row
    basic_info = get_resume_basic_info(resume)
    display_parsed_data = get_display_parsed_data(resume)

    return {
        "id": resume.id,
        "job_requirement_id": resume.job_requirement_id,
        "job_title": job_title,
        "file_name": resume.file_name,
        "file_type": resume.file_type,
        "file_size": resume.file_size,
        "parse_status": resume.parse_status.value,
        "parse_error": resume.parse_error,
        "parsed_data": display_parsed_data,
        "candidate_name": basic_info.get("name"),
        "candidate_email": basic_info.get("email"),
        "candidate_phone": basic_info.get("phone"),
        "created_at": resume.created_at,
        "updated_at": resume.updated_at,
        "file_url": f"/api/v1/resumes/{resume.id}/file"
    }


@router.post("/{resume_id}/retry", status_code=status.HTTP_202_ACCEPTED)
async def retry_resume_parse(
    resume_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    重新解析简历。

    适用于 pending/failed/success 等需要重新触发解析的场景，
    会清空旧的解析结果和分析结果后重新入队。
    """
    from sqlalchemy import and_
    from app.models import AnalysisResult, AnalysisStatus, RecommendationLevel, DimensionScore

    result = await db.execute(
        select(Resume)
        .join(JobRequirement, Resume.job_requirement_id == JobRequirement.id)
        .where(
            and_(
                Resume.id == resume_id,
                JobRequirement.company_id == current_user.company_id
            )
        )
    )
    resume = result.scalar_one_or_none()

    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "简历不存在"}}
        )

    analysis_result = await db.execute(
        select(AnalysisResult).where(AnalysisResult.resume_id == resume.id)
    )
    analysis = analysis_result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    resume.parse_status = ParseStatus.PENDING
    resume.parse_error = None
    resume.parsed_data = None
    resume.candidate_name = None
    resume.candidate_email = None
    resume.candidate_phone = None
    resume.updated_at = now

    if analysis:
        analysis.analysis_status = AnalysisStatus.PENDING
        analysis.overall_score = 0.0
        analysis.recommendation = RecommendationLevel.PENDING
        analysis.recommendation_reason = None
        analysis.strengths = None
        analysis.weaknesses = None
        analysis.analyzed_at = None

        old_scores = await db.execute(
            select(DimensionScore).where(DimensionScore.analysis_id == analysis.id)
        )
        for score in old_scores.scalars().all():
            await db.delete(score)

    await db.commit()

    dispatch_resume_parse(str(resume.id), resume.file_path, resume.file_type.value)

    return {
        "id": str(resume.id),
        "parse_status": "pending"
    }


@router.get("/{resume_id}/file")
async def download_resume_file(
    resume_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """下载简历原始文件"""
    from sqlalchemy import and_
    from pathlib import Path

    result = await db.execute(
        select(Resume)
        .join(JobRequirement, Resume.job_requirement_id == JobRequirement.id)
        .where(
            and_(
                Resume.id == resume_id,
                JobRequirement.company_id == current_user.company_id
            )
        )
    )
    resume = result.scalar_one_or_none()

    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "简历不存在"}}
        )

    file_path = Path(resume.file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "FILE_NOT_FOUND", "message": "文件不存在"}}
        )

    # Determine content type
    content_types = {
        "pdf": "application/pdf",
        "doc": "application/msword",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png"
    }
    content_type = content_types.get(resume.file_type, "application/octet-stream")

    return FileResponse(
        path=file_path,
        filename=resume.file_name,
        media_type=content_type
    )


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(
    resume_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """删除简历"""
    from sqlalchemy import and_
    from app.services.storage_service import StorageService

    result = await db.execute(
        select(Resume)
        .join(JobRequirement, Resume.job_requirement_id == JobRequirement.id)
        .where(
            and_(
                Resume.id == resume_id,
                JobRequirement.company_id == current_user.company_id
            )
        )
    )
    resume = result.scalar_one_or_none()

    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "简历不存在"}}
        )

    # Delete file from storage
    storage_service = StorageService()
    storage_service.delete_file(resume.file_path)

    # Delete from database (cascade will delete analysis result)
    await db.delete(resume)
    await db.commit()
