import asyncio
from contextlib import asynccontextmanager
from contextlib import suppress
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from app.database import async_session
from app.config import get_settings
from app.api import auth, job_requirements, job_templates, job_skill_options, resumes, tasks, analysis, companies, channels, recruitment, candidate_workflows, hr_extensions, agent_runs
from app.middleware.error_handler import (
    http_exception_handler,
    validation_exception_handler,
    generic_exception_handler,
    log_requests
)
from app.services.interview_reminder_service import dispatch_due_interview_reminders

logger = logging.getLogger(__name__)
settings = get_settings()


async def _interview_reminder_loop():
    poll_seconds = max(settings.INTERVIEW_REMINDER_POLL_SECONDS, 10)
    while True:
        try:
            async with async_session() as session:
                result = await dispatch_due_interview_reminders(session)
                if result["sent"] or result["failed"]:
                    logger.info(
                        "interview reminder dispatch finished: sent=%s failed=%s",
                        result["sent"],
                        result["failed"],
                    )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("interview reminder dispatch failed")
        await asyncio.sleep(poll_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.INTERVIEW_REMINDER_WORKER_ENABLED:
        app.state.interview_reminder_task = asyncio.create_task(_interview_reminder_loop())
    try:
        yield
    finally:
        task = getattr(app.state, "interview_reminder_task", None)
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task


app = FastAPI(
    title="HR Resume Screening API",
    description="HR 简历智能筛查系统 API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware
app.middleware("http")(log_requests)

# Exception handlers
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(ValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(job_requirements.router, prefix="/api/v1")
app.include_router(job_templates.router, prefix="/api/v1")
app.include_router(job_skill_options.router, prefix="/api/v1")
app.include_router(resumes.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(analysis.router, prefix="/api/v1")
app.include_router(companies.router, prefix="/api/v1")
app.include_router(channels.router, prefix="/api/v1")
app.include_router(recruitment.router, prefix="/api/v1")
app.include_router(candidate_workflows.router, prefix="/api/v1")
app.include_router(hr_extensions.router, prefix="/api/v1")
app.include_router(agent_runs.router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok"}
