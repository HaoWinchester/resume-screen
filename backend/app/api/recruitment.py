from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import User, get_current_user
from app.database import get_db
from app.models import (
    AnalysisResult,
    AnalysisStatus,
    CandidateWorkflow,
    CandidateWorkflowStatus,
    Dimension,
    DimensionScore,
    JobRequirement,
    JobRequirementStatus,
    RecommendationLevel,
    Resume,
)
from app.schemas.recruitment import (
    CandidateReport,
    JobInsightResponse,
    RecruitmentOverview,
    TalentPoolResponse,
)
from app.services.resume_display import get_display_candidate_name, get_resume_basic_info

router = APIRouter(prefix="/recruitment", tags=["recruitment"])


def _recommendation_label(level: str) -> str:
    if level == RecommendationLevel.STRONGLY_RECOMMENDED.value:
        return "强推荐"
    if level == RecommendationLevel.RECOMMENDED.value:
        return "可沟通"
    return "待确认"


def _extract_skills(dimensions: list[DimensionScore]) -> list[str]:
    skills: list[str] = []
    for dimension in dimensions:
        if dimension.dimension != Dimension.SKILL_MATCH or not isinstance(dimension.match_details, dict):
            continue
        skills.extend(dimension.match_details.get("matched_skills") or [])
        skills.extend(dimension.match_details.get("bonus_skills_matched") or [])
    return list(dict.fromkeys(str(skill) for skill in skills if skill))[:8]


def _dimension_label(dimension: Dimension) -> str:
    labels = {
        Dimension.SKILL_MATCH: "技能匹配",
        Dimension.EXPERIENCE_MATCH: "经验匹配",
        Dimension.EDUCATION: "教育背景",
        Dimension.PROJECT_RELEVANCE: "项目相关性",
        Dimension.OVERALL_QUALITY: "简历质量",
    }
    return labels.get(dimension, dimension.value)


def _risk_flags(analysis: AnalysisResult, dimensions: list[DimensionScore]) -> list[str]:
    risks: list[str] = []
    for dimension in dimensions:
        details = dimension.match_details if isinstance(dimension.match_details, dict) else {}
        if dimension.dimension == Dimension.SKILL_MATCH:
            risks.extend([f"缺少 {skill}" for skill in (details.get("missing_skills") or [])[:3]])
        if float(dimension.score) < 60:
            risks.append(f"{_dimension_label(dimension.dimension)}偏弱")

    if float(analysis.overall_score) < 70:
        risks.append("综合匹配分偏低")

    return list(dict.fromkeys(risks))[:6]


def _unique_names(names: list[str], limit: int = 5) -> list[str]:
    return list(dict.fromkeys(name for name in names if name))[:limit]


async def _analysis_rows(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    limit: int | None = None,
    analysis_id: uuid.UUID | None = None,
    job_id: uuid.UUID | None = None,
) -> list[tuple[AnalysisResult, Resume, JobRequirement, list[DimensionScore]]]:
    query = (
        select(AnalysisResult, Resume, JobRequirement, DimensionScore)
        .join(Resume, AnalysisResult.resume_id == Resume.id)
        .join(JobRequirement, AnalysisResult.job_requirement_id == JobRequirement.id)
        .outerjoin(DimensionScore, AnalysisResult.id == DimensionScore.analysis_id)
        .where(JobRequirement.company_id == company_id)
        .where(AnalysisResult.analysis_status == AnalysisStatus.COMPLETED)
    )
    if analysis_id:
        query = query.where(AnalysisResult.id == analysis_id)
    if job_id:
        query = query.where(JobRequirement.id == job_id)

    query = query.order_by(AnalysisResult.overall_score.desc(), AnalysisResult.analyzed_at.desc().nullslast())
    if limit:
        query = query.limit(limit * 5)

    result = await db.execute(query)
    grouped: dict[uuid.UUID, dict] = {}
    for analysis, resume, job, dimension in result.all():
        if analysis.id not in grouped:
            grouped[analysis.id] = {
                "analysis": analysis,
                "resume": resume,
                "job": job,
                "dimensions": [],
            }
        if dimension:
            grouped[analysis.id]["dimensions"].append(dimension)

    rows = [
        (data["analysis"], data["resume"], data["job"], data["dimensions"])
        for data in grouped.values()
    ]
    rows.sort(key=lambda row: float(row[0].overall_score), reverse=True)
    return rows[:limit] if limit else rows


@router.get("/overview", response_model=RecruitmentOverview)
async def get_recruitment_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job_filter = JobRequirement.company_id == current_user.company_id

    jobs_total = (await db.execute(select(func.count()).select_from(JobRequirement).where(job_filter))).scalar() or 0
    active_jobs = (
        await db.execute(
            select(func.count()).select_from(JobRequirement).where(
                job_filter,
                JobRequirement.status == JobRequirementStatus.ACTIVE,
            )
        )
    ).scalar() or 0
    resumes_total = (
        await db.execute(
            select(func.count()).select_from(Resume).join(JobRequirement).where(job_filter)
        )
    ).scalar() or 0
    analyzed_total = (
        await db.execute(
            select(func.count()).select_from(AnalysisResult)
            .join(JobRequirement)
            .where(job_filter, AnalysisResult.analysis_status == AnalysisStatus.COMPLETED)
        )
    ).scalar() or 0
    strongly_recommended = (
        await db.execute(
            select(func.count()).select_from(AnalysisResult)
            .join(JobRequirement)
            .where(job_filter, AnalysisResult.recommendation == RecommendationLevel.STRONGLY_RECOMMENDED)
        )
    ).scalar() or 0
    recommended = (
        await db.execute(
            select(func.count()).select_from(AnalysisResult)
            .join(JobRequirement)
            .where(job_filter, AnalysisResult.recommendation == RecommendationLevel.RECOMMENDED)
        )
    ).scalar() or 0
    contacted = (
        await db.execute(
            select(func.count()).select_from(CandidateWorkflow).where(
                CandidateWorkflow.company_id == current_user.company_id,
                CandidateWorkflow.status == CandidateWorkflowStatus.CONTACTED,
            )
        )
    ).scalar() or 0
    interview_scheduled = (
        await db.execute(
            select(func.count()).select_from(CandidateWorkflow).where(
                CandidateWorkflow.company_id == current_user.company_id,
                CandidateWorkflow.status == CandidateWorkflowStatus.INTERVIEW_SCHEDULED,
            )
        )
    ).scalar() or 0
    average_score = (
        await db.execute(
            select(func.avg(AnalysisResult.overall_score)).join(JobRequirement).where(
                job_filter,
                AnalysisResult.analysis_status == AnalysisStatus.COMPLETED,
            )
        )
    ).scalar() or 0

    conversion = lambda count: round((count / resumes_total) * 100, 1) if resumes_total else 0.0
    talent_rows = await _analysis_rows(db, current_user.company_id, limit=8)
    candidate_names = _unique_names([get_display_candidate_name(row[1]) for row in talent_rows])
    priority_names = [
        get_display_candidate_name(resume)
        for analysis, resume, _, _ in talent_rows
        if analysis.recommendation in {RecommendationLevel.STRONGLY_RECOMMENDED, RecommendationLevel.RECOMMENDED}
    ]
    review_names = [
        get_display_candidate_name(resume)
        for analysis, resume, _, _ in talent_rows
        if analysis.recommendation not in {RecommendationLevel.STRONGLY_RECOMMENDED, RecommendationLevel.RECOMMENDED}
    ]
    pending_analysis = max(resumes_total - analyzed_total, 0)
    lower_priority = max(analyzed_total - strongly_recommended - recommended, 0)

    return {
        "updated_at": datetime.now(timezone.utc),
        "metrics": [
            {"label": "开放岗位", "value": active_jobs, "tone": "blue"},
            {"label": "候选人总量", "value": resumes_total, "tone": "slate"},
            {"label": "已完成分析", "value": analyzed_total, "tone": "green"},
            {"label": "优先沟通", "value": strongly_recommended + recommended, "tone": "amber"},
            {"label": "平均匹配分", "value": round(float(average_score), 1), "tone": "blue"},
        ],
        "funnel": [
            {"key": "uploaded", "label": "收到简历", "count": resumes_total, "conversion": 100 if resumes_total else 0},
            {"key": "analyzed", "label": "完成分析", "count": analyzed_total, "conversion": conversion(analyzed_total)},
            {"key": "recommended", "label": "可沟通", "count": recommended, "conversion": conversion(recommended)},
            {"key": "strongly_recommended", "label": "强推荐", "count": strongly_recommended, "conversion": conversion(strongly_recommended)},
        ],
        "pipeline": [
            {"key": "to_analyze", "title": "待分析", "description": "已入库但未完成分析", "count": pending_analysis, "candidateNames": []},
            {"key": "to_contact", "title": "优先沟通", "description": "强推荐或可沟通候选人", "count": strongly_recommended + recommended, "candidateNames": _unique_names(priority_names)},
            {"key": "contacted", "title": "已沟通", "description": "HR 已完成至少一次沟通", "count": contacted, "candidateNames": []},
            {"key": "interview_scheduled", "title": "已约面试", "description": "已保存面试时间", "count": interview_scheduled, "candidateNames": []},
            {"key": "to_review", "title": "待人工复核", "description": "已分析但未进入优先沟通", "count": lower_priority, "candidateNames": _unique_names(review_names) or candidate_names},
        ],
        "companyTalent": [
            {"label": "人才库规模", "value": str(analyzed_total), "description": "已完成分析的跨岗位候选人", "icon": "database"},
            {"label": "推荐密度", "value": f"{conversion(strongly_recommended + recommended)}%", "description": "优先沟通人数 / 简历总量", "icon": "insights"},
            {"label": "岗位覆盖", "value": str(active_jobs), "description": "当前招聘中的岗位", "icon": "work"},
        ],
        "jobProfileSuggestions": [
            {
                "title": "岗位画像优化",
                "currentSignal": f"平均匹配分 {round(float(average_score), 1)}",
                "suggestion": "若推荐人数偏低，可降低硬性技能数量或调整最低年限。",
                "impact": "提升候选人池覆盖率",
            }
        ],
        "riskInsights": [
            {
                "title": "简历风险识别",
                "description": "候选人报告页会聚合缺失技能、低分维度和面试验证点。",
                "severity": "medium",
            }
        ],
        "entries": [
            {"title": "优先沟通名单", "description": "查看最值得联系的人", "icon": "connect_without_contact", "href": "/dashboard/shortlist", "tag": "沟通"},
            {"title": "人才库", "description": "跨岗位沉淀候选人", "icon": "database", "href": "/dashboard/talent-pool", "tag": "复用"},
            {"title": "候选人报告", "description": "推荐理由、风险点、面试题", "icon": "article", "href": "/dashboard/talent-pool", "tag": "决策"},
        ],
    }


@router.get("/talent-pool", response_model=TalentPoolResponse)
async def get_talent_pool(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await _analysis_rows(db, current_user.company_id, limit=limit)
    items = []
    for analysis, resume, job, dimensions in rows:
        skills = _extract_skills(dimensions)
        risks = _risk_flags(analysis, dimensions)
        items.append({
            "id": f"{analysis.id}-{resume.id}",
            "analysisId": analysis.id,
            "resumeId": resume.id,
            "candidateName": get_display_candidate_name(resume),
            "jobId": job.id,
            "jobTitle": job.title,
            "score": float(analysis.overall_score),
            "recommendation": analysis.recommendation.value,
            "recommendationLabel": _recommendation_label(analysis.recommendation.value),
            "skills": skills,
            "riskFlags": risks,
            "summary": analysis.recommendation_reason or "综合匹配度较高，可进入下一轮人工判断。",
            "analyzedAt": analysis.analyzed_at,
        })

    return {"items": items, "total": len(items), "generatedAt": datetime.now(timezone.utc)}


@router.get("/job-insights/{job_id}", response_model=JobInsightResponse)
async def get_job_insights(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = (
        await db.execute(
            select(JobRequirement).where(JobRequirement.id == job_id, JobRequirement.company_id == current_user.company_id)
        )
    ).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"error": {"code": "NOT_FOUND", "message": "岗位不存在"}})

    rows = await _analysis_rows(db, current_user.company_id, job_id=job_id)
    total_resumes = (
        await db.execute(select(func.count()).select_from(Resume).where(Resume.job_requirement_id == job_id))
    ).scalar() or 0
    analyzed = len(rows)
    avg_score = round(sum(float(row[0].overall_score) for row in rows) / analyzed, 1) if analyzed else 0.0
    recommended_count = sum(1 for row in rows if row[0].recommendation in {RecommendationLevel.RECOMMENDED, RecommendationLevel.STRONGLY_RECOMMENDED})

    bottlenecks = []
    suggestions = []
    if analyzed == 0:
        bottlenecks.append("暂无完成分析的候选人")
        suggestions.append("先上传或导入候选人，再观察岗位画像效果。")
    if avg_score and avg_score < 70:
        bottlenecks.append("平均匹配分偏低")
        suggestions.append("检查必需技能是否过多，或最低年限是否过高。")
    if recommended_count == 0 and analyzed > 0:
        bottlenecks.append("暂无优先沟通候选人")
        suggestions.append("可放宽加分项或增加可替代技能。")

    return {
        "jobId": job.id,
        "jobTitle": job.title,
        "totalResumes": total_resumes,
        "analyzed": analyzed,
        "avgScore": avg_score,
        "recommendedCount": recommended_count,
        "bottlenecks": bottlenecks or ["岗位画像运行正常"],
        "suggestions": suggestions or ["继续保持当前筛选标准，并关注优先沟通名单。"],
    }


async def _candidate_report_payload(analysis_id: uuid.UUID, current_user: User, db: AsyncSession) -> dict:
    rows = await _analysis_rows(db, current_user.company_id, analysis_id=analysis_id)
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"error": {"code": "NOT_FOUND", "message": "候选人报告不存在"}})

    analysis, resume, job, dimensions = rows[0]
    skills = _extract_skills(dimensions)
    risks = _risk_flags(analysis, dimensions)
    missing_skills = [risk.replace("缺少 ", "") for risk in risks if risk.startswith("缺少 ")]
    focus_skill = skills[0] if skills else "核心技能"
    candidate_name = get_display_candidate_name(resume)
    strengths = analysis.strengths or [analysis.recommendation_reason or "整体匹配度较高"]
    weaknesses = analysis.weaknesses or []

    questions = [
        f"请结合最近一个项目，说明你如何使用 {focus_skill} 解决业务问题？",
        "请讲一次你在项目中做技术取舍的经历，最终结果如何？",
        "如果入职后 30 天需要交付关键模块，你会如何拆解计划？",
        "请复盘一次跨团队协作中的分歧，以及你如何推动共识。",
        f"你认为 {job.title} 这个岗位最需要先验证的能力是什么？",
    ]
    if missing_skills:
        questions.insert(1, f"简历中较少体现 {missing_skills[0]}，你是否有相关经验？")

    return {
        "id": analysis.id,
        "candidateName": candidate_name,
        "candidateEmail": get_resume_basic_info(resume).get("email"),
        "jobTitle": job.title,
        "score": float(analysis.overall_score),
        "recommendation": analysis.recommendation.value,
        "recommendationLabel": _recommendation_label(analysis.recommendation.value),
        "recommendationReasons": strengths[:6],
        "riskPoints": (risks + weaknesses)[:8] or ["暂未发现明显风险，建议面试中继续验证真实项目贡献。"],
        "interviewQuestions": questions[:5],
        "outreachScripts": [
            f"你好 {candidate_name}，我们看到了你在 {focus_skill} 方面的经历，和 {job.title} 的要求比较契合，想约一次初步沟通。",
            "如果你近期考虑新机会，我们希望重点聊聊你过往项目职责、技术判断和下一阶段发展期待。",
        ],
        "skills": skills,
        "generatedAt": analysis.analyzed_at,
    }


@router.get("/candidate-report/{analysis_id}", response_model=CandidateReport)
async def get_candidate_report(
    analysis_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _candidate_report_payload(analysis_id, current_user, db)


@router.get("/reports/{analysis_id}", response_model=CandidateReport)
async def get_candidate_report_alias(
    analysis_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _candidate_report_payload(analysis_id, current_user, db)
