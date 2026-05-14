import uuid
import logging
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from app.config import get_settings
from app.models import Resume, ParseStatus, AnalysisResult, AnalysisStatus
from app.services.ai_resume_parser import AIResumeParser
from app.services.resume_parser import ResumeParser
from app.worker import celery_app

settings = get_settings()
logger = logging.getLogger(__name__)


async def run_parse_resume(resume_id: str, file_path: str, file_type: str):
    """
    Parse a resume file and persist extracted fields.

    This async entry point can run either from Celery or from the local
    background executor, so upload parsing does not depend on a separate
    worker process being available.
    """
    from sqlalchemy import select

    from app.tasks.task_db import task_session

    async with task_session() as db:
        resume = None

        try:
            result = await db.execute(
                select(Resume).where(Resume.id == uuid.UUID(resume_id))
            )
            resume = result.scalar_one_or_none()

            if not resume:
                logger.warning("Resume %s not found when starting parse task", resume_id)
                return {"error": "Resume not found"}

            # Update status to parsing
            resume.parse_status = ParseStatus.PARSING
            resume.updated_at = datetime.now(timezone.utc)
            await db.commit()

            # Parse the file
            parser = ResumeParser()
            raw_text = await parser.parse_file(file_path, file_type)
            parsed_data = parser.extract_structured_data(raw_text)

            if settings.AI_RESUME_PARSER_ENABLED:
                ai_parser = AIResumeParser()
                parsed_data = await ai_parser.parse(raw_text, parsed_data)

            # Update resume with parsed data
            resume.parsed_data = parsed_data
            resume.parse_status = ParseStatus.SUCCESS
            resume.candidate_name = parsed_data.get("name")
            resume.candidate_email = parsed_data.get("email")
            resume.candidate_phone = parsed_data.get("phone")
            resume.parse_error = None
            resume.updated_at = datetime.now(timezone.utc)

            await db.commit()
            await db.refresh(resume)

            # Trigger analysis task
            from app.services.task_dispatcher import dispatch_resume_analysis

            dispatch_resume_analysis(str(resume.id), str(resume.job_requirement_id))

            return {
                "resume_id": str(resume.id),
                "status": "success",
                "candidate_name": resume.candidate_name
            }

        except Exception as e:
            # Update status to failed
            if resume:
                resume.parse_status = ParseStatus.FAILED
                resume.parse_error = str(e)
                resume.updated_at = datetime.now(timezone.utc)
                await db.commit()

                # Also mark analysis as failed
                result = await db.execute(
                    select(AnalysisResult).where(AnalysisResult.resume_id == resume.id)
                )
                analysis = result.scalar_one_or_none()
                if analysis:
                    analysis.analysis_status = AnalysisStatus.FAILED
                    await db.commit()

            return {
                "resume_id": str(resume.id) if resume else resume_id,
                "status": "failed",
                "error": str(e)
            }


@celery_app.task(bind=True, name="app.tasks.parse_resume")
def parse_resume_task(self, resume_id: str, file_path: str, file_type: str):
    """
    Parse resume file and extract structured data.

    This Celery task:
    1. Updates parse_status to 'parsing'
    2. Parses the file using ResumeParser
    3. Extracts structured data (name, email, phone, education, experience, skills, projects)
    4. Saves parsed_data to the resume record
    5. Updates parse_status to 'success' or 'failed'
    6. Triggers analysis task on success
    """
    import asyncio

    # Run async code in sync context
    return asyncio.run(run_parse_resume(resume_id, file_path, file_type))
