from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import get_settings
from app.api import auth, job_requirements, job_templates, resumes, tasks, analysis, companies
from app.middleware.error_handler import (
    http_exception_handler,
    validation_exception_handler,
    generic_exception_handler,
    log_requests
)

app = FastAPI(
    title="HR Resume Screening API",
    description="HR 简历智能筛查系统 API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

settings = get_settings()

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
app.include_router(resumes.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(analysis.router, prefix="/api/v1")
app.include_router(companies.router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok"}
