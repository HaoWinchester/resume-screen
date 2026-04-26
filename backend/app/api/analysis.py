from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case, literal_column
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import quote as url_quote
from typing import Optional

from app.database import get_db
from app.api.deps import get_current_user, get_pagination_params, User
from app.models import (
    Resume, AnalysisResult, AnalysisStatus, DimensionScore,
    JobRequirement, RecommendationLevel, ParseStatus
)
from app.services.task_dispatcher import dispatch_resume_analysis
from app.services.ai_analyzer import AIAnalyzer
from app.services.resume_display import (
    get_display_candidate_name,
    get_display_parsed_data,
    get_resume_basic_info,
)
from app.schemas.analysis import (
    AnalysisListResponse,
    AnalysisListItem,
    DimensionScoreItem,
    AnalysisDetail,
    DimensionScoreDetail,
    MatchDetails,
    AnalysisStatistics,
    RecentActivityItem,
    RecentActivityResponse,
    ResumeProgressDay,
    ResumeProgressResponse,
    ComparisonResponse,
    ComparisonCandidate
)
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/analysis", tags=["analysis"])


def _display_candidate_name(resume: Resume) -> str:
    return get_display_candidate_name(resume)


@router.get("", response_model=AnalysisListResponse)
async def list_analysis_results(
    job_requirement_id: uuid.UUID = Query(..., description="岗位需求ID"),
    sort_by: str = Query("overall_score", description="排序字段"),
    sort_order: str = Query("desc", description="排序方向: asc/desc"),
    recommendation: Optional[str] = Query(None, description="推荐等级筛选"),
    pagination: tuple[int, int] = Depends(get_pagination_params),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取岗位下所有简历的分析结果

    - 支持按维度排序
    - 支持按推荐等级筛选
    - 包含统计信息
    """
    page, per_page = pagination

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

    # Build query
    query = (
        select(AnalysisResult, Resume, DimensionScore)
        .join(Resume, AnalysisResult.resume_id == Resume.id)
        .outerjoin(DimensionScore, AnalysisResult.id == DimensionScore.analysis_id)
        .where(AnalysisResult.job_requirement_id == job_requirement_id)
    )

    if recommendation:
        query = query.where(AnalysisResult.recommendation == recommendation)

    # Get statistics
    total_resumes_result = await db.execute(
        select(func.count()).select_from(Resume).where(
            Resume.job_requirement_id == job_requirement_id
        )
    )
    total_resumes = total_resumes_result.scalar() or 0

    analyzed_result = await db.execute(
        select(func.count())
        .select_from(AnalysisResult)
        .where(
            AnalysisResult.job_requirement_id == job_requirement_id,
            AnalysisResult.analysis_status == AnalysisStatus.COMPLETED
        )
    )
    analyzed = analyzed_result.scalar() or 0

    pending_result = await db.execute(
        select(func.count())
        .select_from(Resume)
        .where(
            Resume.job_requirement_id == job_requirement_id,
            Resume.parse_status == ParseStatus.PENDING
        )
    )
    pending = pending_result.scalar() or 0

    failed_result = await db.execute(
        select(func.count())
        .select_from(AnalysisResult)
        .join(Resume, AnalysisResult.resume_id == Resume.id)
        .where(
            Resume.job_requirement_id == job_requirement_id,
            AnalysisResult.analysis_status == AnalysisStatus.FAILED
        )
    )
    failed = failed_result.scalar() or 0

    strongly_recommended_result = await db.execute(
        select(func.count())
        .select_from(AnalysisResult)
        .where(
            AnalysisResult.job_requirement_id == job_requirement_id,
            AnalysisResult.recommendation == RecommendationLevel.STRONGLY_RECOMMENDED
        )
    )
    strongly_recommended = strongly_recommended_result.scalar() or 0

    recommended_result = await db.execute(
        select(func.count())
        .select_from(AnalysisResult)
        .where(
            AnalysisResult.job_requirement_id == job_requirement_id,
            AnalysisResult.recommendation == RecommendationLevel.RECOMMENDED
        )
    )
    recommended_count = recommended_result.scalar() or 0

    avg_score_result = await db.execute(
        select(func.avg(AnalysisResult.overall_score))
        .where(
            AnalysisResult.job_requirement_id == job_requirement_id,
            AnalysisResult.analysis_status == AnalysisStatus.COMPLETED
        )
    )
    average_score = avg_score_result.scalar() or 0.0

    statistics = AnalysisStatistics(
        total_resumes=total_resumes,
        analyzed=analyzed,
        pending=pending,
        failed=failed,
        strongly_recommended=strongly_recommended,
        recommended=recommended_count,
        average_score=float(average_score)
    )

    # Get total count for pagination
    count_query = select(func.count()).select_from(AnalysisResult).where(
        AnalysisResult.job_requirement_id == job_requirement_id
    )
    if recommendation:
        count_query = count_query.where(AnalysisResult.recommendation == recommendation)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results with sorting
    if sort_order == "desc":
        query = query.order_by(AnalysisResult.overall_score.desc())
    else:
        query = query.order_by(AnalysisResult.overall_score.asc())

    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    rows = result.all()

    # Group results by analysis
    analysis_map = {}
    for row in rows:
        analysis, resume, dimension = row
        if analysis.id not in analysis_map:
            analysis_map[analysis.id] = {
                "analysis": analysis,
                "resume": resume,
                "dimensions": []
            }
        if dimension:
            analysis_map[analysis.id]["dimensions"].append(dimension)

    items = []
    for data in analysis_map.values():
        analysis = data["analysis"]
        resume = data["resume"]
        dimensions = data["dimensions"]

        dimension_items = [
            DimensionScoreItem(
                dimension=d.dimension.value,
                score=float(d.score),
                weight=d.weight,
                match_details=d.match_details if isinstance(d.match_details, dict) else None
            )
            for d in dimensions
        ]

        items.append(AnalysisListItem(
            id=analysis.id,
            resume_id=resume.id,
            candidate_name=_display_candidate_name(resume),
            overall_score=float(analysis.overall_score),
            recommendation=analysis.recommendation.value,
            recommendation_reason=analysis.recommendation_reason,
            dimension_scores=dimension_items,
            analyzed_at=analysis.analyzed_at
        ))

    return AnalysisListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        statistics=statistics
    )


# IMPORTANT: static routes such as /progress, /compare and /export must be
# registered BEFORE /{analysis_id} to avoid FastAPI matching them as IDs.


@router.get("/progress", response_model=ResumeProgressResponse)
async def get_resume_progress(
    days: int = Query(7, ge=1, le=30, description="统计最近 N 天"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取当前公司最近 N 天真实简历上传与解析进度。"""
    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=days - 1)
    day_keys = [(start_date + timedelta(days=offset)).isoformat() for offset in range(days)]
    weekday_labels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    buckets = {
        key: {"uploaded": 0, "parsed": 0, "failed": 0, "processing": 0}
        for key in day_keys
    }

    result = await db.execute(
        select(Resume.created_at, Resume.parse_status)
        .join(JobRequirement, Resume.job_requirement_id == JobRequirement.id)
        .where(
            JobRequirement.company_id == current_user.company_id,
            Resume.created_at >= datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
        )
    )

    for created_at, parse_status in result.all():
        if not created_at:
            continue

        created_date = created_at.date().isoformat()
        if created_date not in buckets:
            continue

        bucket = buckets[created_date]
        bucket["uploaded"] += 1
        if parse_status == ParseStatus.SUCCESS:
            bucket["parsed"] += 1
        elif parse_status == ParseStatus.FAILED:
            bucket["failed"] += 1
        elif parse_status in {ParseStatus.PENDING, ParseStatus.PARSING}:
            bucket["processing"] += 1

    progress_days = []
    for key in day_keys:
        current_date = datetime.fromisoformat(key).date()
        bucket = buckets[key]
        progress_days.append(
            ResumeProgressDay(
                date=key,
                label=weekday_labels[current_date.weekday()],
                uploaded=bucket["uploaded"],
                parsed=bucket["parsed"],
                failed=bucket["failed"],
                processing=bucket["processing"],
            )
        )

    return ResumeProgressResponse(
        days=progress_days,
        total_uploaded=sum(day.uploaded for day in progress_days),
        total_parsed=sum(day.parsed for day in progress_days),
        total_failed=sum(day.failed for day in progress_days),
        total_processing=sum(day.processing for day in progress_days),
    )


@router.get("/activity", response_model=RecentActivityResponse)
async def get_recent_activity(
    limit: int = Query(4, ge=1, le=20, description="返回最近活动数量"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """根据真实简历和岗位记录生成最近活动。"""
    activities: list[RecentActivityItem] = []

    resume_rows = await db.execute(
        select(Resume, JobRequirement)
        .join(JobRequirement, Resume.job_requirement_id == JobRequirement.id)
        .where(JobRequirement.company_id == current_user.company_id)
        .order_by(Resume.created_at.desc())
        .limit(limit * 3)
    )

    for resume, job in resume_rows.all():
        candidate = _display_candidate_name(resume)
        if resume.parse_status == ParseStatus.SUCCESS:
            title = "简历解析完成"
            description = f"{candidate} 已完成“{job.title}”岗位的简历解析。"
            icon = "upload_file"
            tone = "green"
            activity_type = "resume_parsed"
        elif resume.parse_status == ParseStatus.FAILED:
            title = "解析失败"
            description = f"{resume.file_name} 在“{job.title}”岗位解析失败。"
            icon = "warning"
            tone = "amber"
            activity_type = "resume_failed"
        else:
            title = "简历处理中"
            description = f"{resume.file_name} 已上传至“{job.title}”，正在解析。"
            icon = "pending"
            tone = "blue"
            activity_type = "resume_processing"

        activities.append(
            RecentActivityItem(
                id=f"resume-{resume.id}",
                type=activity_type,
                title=title,
                description=description,
                occurred_at=resume.created_at,
                icon=icon,
                tone=tone,
            )
        )

    job_rows = await db.execute(
        select(JobRequirement)
        .where(JobRequirement.company_id == current_user.company_id)
        .order_by(JobRequirement.updated_at.desc())
        .limit(limit * 2)
    )

    for job in job_rows.scalars().all():
        if not job.updated_at or not job.created_at:
            continue
        if abs((job.updated_at - job.created_at).total_seconds()) < 1:
            continue

        activities.append(
            RecentActivityItem(
                id=f"job-{job.id}",
                type="job_updated",
                title="筛选条件已更新",
                description=f"“{job.title}”的岗位配置已更新。",
                occurred_at=job.updated_at,
                icon="edit",
                tone="blue",
            )
        )

    activities.sort(key=lambda item: item.occurred_at, reverse=True)
    return RecentActivityResponse(items=activities[:limit])

@router.get("/compare", response_model=ComparisonResponse)
async def compare_candidates(
    analysis_ids: str = Query(..., description="分析结果ID，逗号分隔（2-3个）"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    候选人对比

    - 支持 2-3 位候选人对比
    - 返回维度评分和关键信息
    """
    # Parse and validate analysis IDs
    id_list = [uuid.UUID(id.strip()) for id in analysis_ids.split(",")]

    if len(id_list) < 2 or len(id_list) > 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "INVALID_COUNT", "message": "仅支持2-3位候选人对比"}}
        )

    # Get analysis results with company isolation
    result = await db.execute(
        select(AnalysisResult, Resume, DimensionScore)
        .join(Resume, AnalysisResult.resume_id == Resume.id)
        .join(JobRequirement, AnalysisResult.job_requirement_id == JobRequirement.id)
        .outerjoin(DimensionScore, AnalysisResult.id == DimensionScore.analysis_id)
        .where(
            and_(
                AnalysisResult.id.in_(id_list),
                JobRequirement.company_id == current_user.company_id,
                AnalysisResult.analysis_status == AnalysisStatus.COMPLETED
            )
        )
    )
    rows = result.all()

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "未找到分析结果"}}
        )

    # Group by analysis
    analysis_map = {}
    for row in rows:
        analysis, resume, dimension = row
        if analysis.id not in analysis_map:
            analysis_map[analysis.id] = {
                "analysis": analysis,
                "resume": resume,
                "dimensions": []
            }
        if dimension:
            analysis_map[analysis.id]["dimensions"].append(dimension)

    candidates = []
    for data in analysis_map.values():
        analysis = data["analysis"]
        resume = data["resume"]
        dimensions = data["dimensions"]

        dimension_items = [
            DimensionScoreItem(
                dimension=d.dimension.value,
                score=float(d.score),
                weight=d.weight
            )
            for d in dimensions
        ]

        # Extract key info
        parsed_data = resume.parsed_data or {}
        education_list = parsed_data.get("education", [])
        education_str = education_list[0].get("degree", "未知") if education_list else "未知"

        experience_list = parsed_data.get("work_experience", [])
        experience_years = 0
        if experience_list:
            # Try to extract years from first experience
            pass  # Would need more parsing

        candidates.append(ComparisonCandidate(
            analysis_id=analysis.id,
            candidate_name=_display_candidate_name(resume),
            overall_score=float(analysis.overall_score),
            dimension_scores=dimension_items,
            key_info={
                "experience_years": experience_years,
                "education": education_str,
                "top_skills": parsed_data.get("skills", [])[:5]
            }
        ))

    return ComparisonResponse(candidates=candidates)


@router.get("/export")
async def export_analysis_results(
    job_requirement_id: uuid.UUID = Query(..., description="岗位需求ID"),
    format: str = Query("xlsx", description="导出格式: xlsx/csv"),
    recommendation: Optional[str] = Query(None, description="推荐等级筛选"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    导出分析结果

    - 支持 xlsx 和 csv 格式
    - 可按推荐等级筛选
    """
    from fastapi.responses import Response
    from app.services.export_service import ExportService

    # Verify job requirement
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

    # Get analysis results
    query = (
        select(AnalysisResult, Resume)
        .join(Resume, AnalysisResult.resume_id == Resume.id)
        .where(
            AnalysisResult.job_requirement_id == job_requirement_id,
            AnalysisResult.analysis_status == AnalysisStatus.COMPLETED
        )
    )

    if recommendation:
        query = query.where(AnalysisResult.recommendation == recommendation)

    query = query.order_by(AnalysisResult.overall_score.desc())
    result = await db.execute(query)
    rows = result.all()

    # Get dimension scores for each analysis
    analysis_data = []
    for row in rows:
        analysis, resume = row
        dimensions_result = await db.execute(
            select(DimensionScore).where(DimensionScore.analysis_id == analysis.id)
        )
        dimensions = dimensions_result.scalars().all()

        dim_scores = {d.dimension.value: float(d.score) for d in dimensions}

        basic_info = get_resume_basic_info(resume)

        analysis_data.append({
            "candidate_name": basic_info.get("name") or "未知候选人",
            "email": basic_info.get("email") or "",
            "overall_score": float(analysis.overall_score),
            "recommendation": analysis.recommendation.value,
            "skill_match": dim_scores.get("skill_match", 0),
            "experience_match": dim_scores.get("experience_match", 0),
            "education": dim_scores.get("education", 0),
            "project_relevance": dim_scores.get("project_relevance", 0),
            "overall_quality": dim_scores.get("overall_quality", 0)
        })

    # Generate export
    export_service = ExportService()

    if format == "csv":
        file_content, filename = export_service.generate_csv(
            analysis_data,
            job.title
        )
        media_type = "text/csv"
    else:
        file_content, filename = export_service.generate_xlsx(
            analysis_data,
            job.title
        )
        media_type = "application/octet-stream"

    return Response(
        content=file_content,
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{url_quote(filename)}"
        }
    )


@router.get("/{analysis_id}", response_model=AnalysisDetail)
async def get_analysis_detail(
    analysis_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取单份简历的详细分析报告

    - 包含维度评分、优势劣势、匹配详情
    - 包含简历和岗位完整信息
    """
    # Get analysis result with company isolation
    result = await db.execute(
        select(AnalysisResult, Resume, JobRequirement)
        .join(Resume, AnalysisResult.resume_id == Resume.id)
        .join(JobRequirement, AnalysisResult.job_requirement_id == JobRequirement.id)
        .where(
            and_(
                AnalysisResult.id == analysis_id,
                JobRequirement.company_id == current_user.company_id
            )
        )
    )
    row = result.first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "分析结果不存在"}}
        )

    analysis, resume, job = row

    # Get dimension scores
    dimensions_result = await db.execute(
        select(DimensionScore).where(DimensionScore.analysis_id == analysis_id)
    )
    dimensions = dimensions_result.scalars().all()

    dimension_details = []
    for d in dimensions:
        match_details_dict = d.match_details if d.match_details else {}
        match_details_obj = None
        if "matched_skills" in match_details_dict or "missing_skills" in match_details_dict:
            match_details_obj = MatchDetails(
                matched_skills=match_details_dict.get("matched_skills", []),
                missing_skills=match_details_dict.get("missing_skills", []),
                bonus_skills_matched=match_details_dict.get("bonus_skills_matched", [])
            )

        dimension_details.append(DimensionScoreDetail(
            dimension=d.dimension.value,
            score=float(d.score),
            weight=d.weight,
            analysis_text=d.analysis_text,
            match_details=match_details_dict
        ))

    basic_info = get_resume_basic_info(resume)
    display_parsed_data = get_display_parsed_data(resume)

    return AnalysisDetail(
        id=analysis.id,
        resume_id=resume.id,
        job_requirement_id=job.id,
        overall_score=float(analysis.overall_score),
        recommendation=analysis.recommendation.value,
        recommendation_reason=analysis.recommendation_reason,
        strengths=analysis.strengths or [],
        weaknesses=analysis.weaknesses or [],
        dimension_scores=dimension_details,
        resume={
            "id": resume.id,
            "file_name": resume.file_name,
            "candidate_name": basic_info.get("name"),
            "candidate_email": basic_info.get("email"),
            "candidate_phone": basic_info.get("phone"),
            "parsed_data": display_parsed_data
        },
        job_requirement={
            "id": job.id,
            "title": job.title,
            "criteria": job.criteria
        },
        analyzed_at=analysis.analyzed_at
    )


@router.post("/{analysis_id}/retry", status_code=status.HTTP_202_ACCEPTED)
async def retry_analysis(
    analysis_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    重新分析（当分析失败时）

    - 重新触发 Celery 任务
    - 仅支持 failed 或 completed 状态的重试
    """
    from sqlalchemy import and_

    result = await db.execute(
        select(AnalysisResult, Resume)
        .join(Resume, AnalysisResult.resume_id == Resume.id)
        .join(JobRequirement, AnalysisResult.job_requirement_id == JobRequirement.id)
        .where(
            and_(
                AnalysisResult.id == analysis_id,
                JobRequirement.company_id == current_user.company_id
            )
        )
    )
    row = result.first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "分析结果不存在"}}
        )

    analysis, resume = row

    if resume.parse_status != ParseStatus.SUCCESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "RESUME_NOT_PARSED", "message": "简历尚未解析成功，无法重新分析"}}
        )

    # Reset status to pending
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

    # Re-dispatch task
    dispatch_resume_analysis(str(resume.id), str(analysis.job_requirement_id))

    return {
        "id": str(analysis.id),
        "analysis_status": "pending"
    }
