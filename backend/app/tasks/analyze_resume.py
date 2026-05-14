import uuid
import asyncio
import logging
from datetime import datetime, timezone

from app.config import get_settings
from app.models import Resume, AnalysisResult, AnalysisStatus, DimensionScore, Dimension, RecommendationLevel, JobRequirement
from app.services.ai_analyzer import AIAnalyzer
from app.worker import celery_app

settings = get_settings()
logger = logging.getLogger(__name__)


async def _maybe_enqueue_agent_run(db, analysis: AnalysisResult, resume: Resume, job: JobRequirement) -> dict:
    if not settings.AGENT_TEAM_AUTO_RUN_ENABLED:
        return {}

    try:
        from app.services.agent_runtime_service import AgentRuntimeService
        from app.services.task_dispatcher import dispatch_agent_run

        service = AgentRuntimeService(db)
        run, created = await service.ensure_run_for_analysis(
            company_id=job.company_id,
            analysis_id=analysis.id,
            created_by=resume.uploaded_by or job.created_by,
            fresh_after=analysis.analyzed_at,
        )
        dispatch_mode = dispatch_agent_run(str(run.id)) if created else None
        return {
            "agent_run_id": str(run.id),
            "agent_run_dispatched": bool(dispatch_mode),
            "agent_run_dispatch_mode": dispatch_mode,
        }
    except Exception as exc:
        logger.exception("Failed to enqueue agent run for analysis %s", analysis.id)
        return {
            "agent_run_error": str(exc),
        }


async def run_analyze_resume(
    resume_id: str,
    job_requirement_id: str,
    *,
    raise_exceptions: bool = False,
):
    """
    Analyze a parsed resume and persist dimension scores.

    This async entry point is shared by Celery workers and the local
    background executor so analysis continues even when Celery is not
    running in the current environment.
    """
    from sqlalchemy import select
    from app.tasks.task_db import task_session

    async with task_session() as db:
        analysis = None

        try:
            # Get resume and job requirement
            result = await db.execute(
                select(Resume).where(Resume.id == uuid.UUID(resume_id))
            )
            resume = result.scalar_one_or_none()

            if not resume or not resume.parsed_data:
                return {"error": "Resume not found or not parsed"}

            result = await db.execute(
                select(JobRequirement).where(JobRequirement.id == uuid.UUID(job_requirement_id))
            )
            job = result.scalar_one_or_none()

            if not job:
                return {"error": "Job requirement not found"}

            # Get or create analysis result
            result = await db.execute(
                select(AnalysisResult).where(AnalysisResult.resume_id == resume.id)
            )
            analysis = result.scalar_one_or_none()

            if not analysis:
                analysis = AnalysisResult(
                    resume_id=resume.id,
                    job_requirement_id=job.id,
                    overall_score=0.0,
                    recommendation=RecommendationLevel.PENDING,
                    analysis_status=AnalysisStatus.PENDING
                )
                db.add(analysis)
                await db.flush()

            # Update status to analyzing
            analysis.analysis_status = AnalysisStatus.ANALYZING
            await db.commit()

            # Run AI analysis
            analyzer = AIAnalyzer()
            job_context = {
                **(job.criteria or {}),
                "job_title": job.title,
                "job_description": job.description,
            }
            ai_result = await analyzer.analyze_resume(job_context, resume.parsed_data)

            # Extract dimension scores
            dimension_scores = {}
            for dim_name, dim_data in ai_result.items():
                if dim_name in ["strengths", "weaknesses", "recommendation_reason", "interview_questions", "next_actions"]:
                    continue
                if isinstance(dim_data, dict) and "score" in dim_data:
                    dimension_scores[dim_name] = dim_data

            # Calculate overall score
            weights = job_context.get("weights", {})
            overall_score = analyzer.calculate_overall_score(dimension_scores, weights)

            # Get all analysis results for this job to calculate ranking
            all_results = await db.execute(
                select(AnalysisResult)
                .where(AnalysisResult.job_requirement_id == job.id)
                .where(AnalysisResult.analysis_status == AnalysisStatus.COMPLETED)
            )
            all_analyses = all_results.scalars().all()

            completed_scores = [item.overall_score for item in all_analyses]
            rank = 1 + sum(score > overall_score for score in completed_scores)
            total_count = len(completed_scores) + 1

            # Calculate recommendation level
            recommendation = analyzer.calculate_recommendation_level(
                overall_score,
                rank,
                total_count
            )

            # Update analysis result
            analysis.overall_score = overall_score
            analysis.recommendation = recommendation
            analysis.recommendation_reason = ai_result.get("recommendation_reason") or (
                f"综合评分{overall_score}分，候选人与{job.title}岗位的核心要求匹配度较高"
                if overall_score >= 70
                else f"综合评分{overall_score}分，候选人与{job.title}岗位仍有关键匹配点需要验证"
            )
            analysis.strengths = ai_result.get("strengths", [])
            analysis.weaknesses = ai_result.get("weaknesses", [])
            analysis.analysis_status = AnalysisStatus.COMPLETED
            analysis.analyzed_at = datetime.now(timezone.utc)

            # Delete existing dimension scores
            old_scores = await db.execute(
                select(DimensionScore).where(DimensionScore.analysis_id == analysis.id)
            )
            for old_score in old_scores.scalars().all():
                await db.delete(old_score)

            # Create dimension score records
            weight_map = {
                "skill_match": Dimension.SKILL_MATCH,
                "experience_match": Dimension.EXPERIENCE_MATCH,
                "education": Dimension.EDUCATION,
                "project_relevance": Dimension.PROJECT_RELEVANCE,
                "overall_quality": Dimension.OVERALL_QUALITY
            }

            for dim_name, dim_data in ai_result.items():
                if dim_name in ["strengths", "weaknesses", "recommendation_reason", "interview_questions", "next_actions"]:
                    continue
                if isinstance(dim_data, dict) and "score" in dim_data:
                    dimension_enum = weight_map.get(dim_name)
                    if not dimension_enum:
                        continue

                    weight_value = weights.get(dim_name, "medium")

                    dimension_score = DimensionScore(
                        analysis_id=analysis.id,
                        dimension=dimension_enum,
                        score=float(dim_data["score"]),
                        weight=weight_value,
                        analysis_text=dim_data.get("analysis", ""),
                        match_details=dim_data
                    )
                    db.add(dimension_score)

            await db.commit()
            await db.refresh(analysis)
            agent_run_info = await _maybe_enqueue_agent_run(db, analysis, resume, job)

            return {
                "analysis_id": str(analysis.id),
                "overall_score": overall_score,
                "recommendation": recommendation,
                **agent_run_info,
            }

        except Exception as e:
            # Update status to failed
            if analysis:
                analysis.analysis_status = AnalysisStatus.FAILED
                await db.commit()

            if raise_exceptions:
                raise

            return {
                "resume_id": resume_id,
                "status": "failed",
                "error": str(e)
            }


@celery_app.task(bind=True, name="app.tasks.analyze_resume", max_retries=3)
def analyze_resume_task(self, resume_id: str, job_requirement_id: str):
    """
    Analyze resume using AI and calculate dimension scores.

    This Celery task:
    1. Updates analysis_status to 'analyzing'
    2. Fetches resume parsed_data and job requirement criteria
    3. Calls AI analyzer service
    4. Creates/updates DimensionScore records
    5. Calculates overall_score using weighted formula
    6. Determines recommendation level
    7. Updates analysis_status to 'completed' or 'failed'
    """
    try:
        # Run async code in sync context
        return asyncio.run(
            run_analyze_resume(resume_id, job_requirement_id, raise_exceptions=True)
        )
    except Exception as e:
        # Retry if possible
        try:
            raise self.retry(exc=e, countdown=60)
        except Exception:
            pass

        return {
            "resume_id": resume_id,
            "status": "failed",
            "error": str(e)
        }
