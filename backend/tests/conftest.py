"""
Shared test fixtures for the ResumeAssistant backend test suite.

Uses SQLite (aiosqlite) for testing instead of PostgreSQL to avoid
external dependencies. All tables are created and dropped for each test
to ensure isolation.
"""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import (
    Company,
    User,
    UserRole,
    JobRequirement,
    JobRequirementStatus,
    Resume,
    ResumeFileType,
    ParseStatus,
    AnalysisResult,
    AnalysisStatus,
    RecommendationLevel,
    DimensionScore,
    Dimension,
)
from app.services.auth_service import AuthService


# ---------------------------------------------------------------------------
# Database engine / session for tests (SQLite)
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ---------------------------------------------------------------------------
# SQLite compatibility: enable FK enforcement & handle ENUM columns
# ---------------------------------------------------------------------------

@event.listens_for(test_engine.sync_engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


# ---------------------------------------------------------------------------
# Fixture: database session (per-test, with table create/drop)
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture(autouse=True)
async def _setup_database():
    """
    Create all tables before each test and drop them afterwards.
    This guarantees every test starts with a clean schema.
    """
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional database session for tests."""
    async with TestSessionLocal() as session:
        yield session
        await session.close()


# ---------------------------------------------------------------------------
# Fixture: FastAPI test client (overrides get_db dependency)
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def async_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    Provide an httpx AsyncClient wired to the FastAPI app with the
    test database session injected via dependency override.
    """

    async def _override_get_db():
        yield db_session

    from app.main import app

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Fixture: AuthService (wraps the test session)
# ---------------------------------------------------------------------------

@pytest.fixture
def auth_service(db_session: AsyncSession) -> AuthService:
    return AuthService(db_session)


# ---------------------------------------------------------------------------
# Helper: create a user (and its company) in the database
# ---------------------------------------------------------------------------

async def _create_user_with_company(
    session: AsyncSession,
    *,
    email: str = "admin@example.com",
    name: str = "Test Admin",
    password: str = "secret1234",
    company_name: str = "Test Company",
    role: UserRole = UserRole.ADMIN,
    is_active: bool = True,
) -> tuple[Company, User]:
    company = Company(
        name=company_name,
        industry="Technology",
        contact_name="HR Talent",
        contact_phone="13800000000",
        contact_email="hr@example.com",
    )
    session.add(company)
    await session.flush()

    auth_svc = AuthService(session)
    user = User(
        email=email,
        password_hash=auth_svc.get_password_hash(password),
        name=name,
        role=role,
        company_id=company.id,
        is_active=is_active,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return company, user


def _make_auth_headers(user: User, auth_service: AuthService) -> dict[str, str]:
    token = auth_service.create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "role": user.role.value,
            "company_id": str(user.company_id),
        }
    )
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Standard domain-object fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def test_company(db_session: AsyncSession) -> Company:
    company = Company(
        name="Test Company",
        industry="Technology",
        contact_name="HR Talent",
        contact_phone="13800000000",
        contact_email="hr@example.com",
    )
    db_session.add(company)
    await db_session.commit()
    await db_session.refresh(company)
    return company


@pytest_asyncio.fixture
async def test_user(
    db_session: AsyncSession,
    test_company: Company,
    auth_service: AuthService,
) -> User:
    user = User(
        email="admin@example.com",
        password_hash=auth_service.get_password_hash("secret1234"),
        name="Test Admin",
        role=UserRole.ADMIN,
        company_id=test_company.id,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_operator(
    db_session: AsyncSession,
    test_company: Company,
    auth_service: AuthService,
) -> User:
    user = User(
        email="operator@example.com",
        password_hash=auth_service.get_password_hash("secret1234"),
        name="Test Operator",
        role=UserRole.OPERATOR,
        company_id=test_company.id,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def second_company_user(
    db_session: AsyncSession,
    auth_service: AuthService,
) -> tuple[Company, User]:
    company = Company(name="Other Corp", industry="Finance")
    db_session.add(company)
    await db_session.flush()

    user = User(
        email="other@example.com",
        password_hash=auth_service.get_password_hash("secret1234"),
        name="Other Admin",
        role=UserRole.ADMIN,
        company_id=company.id,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return company, user


# ---------------------------------------------------------------------------
# Auth-header fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def auth_headers(
    test_user: User,
    auth_service: AuthService,
) -> dict[str, str]:
    return _make_auth_headers(test_user, auth_service)


@pytest_asyncio.fixture
async def operator_headers(
    test_operator: User,
    auth_service: AuthService,
) -> dict[str, str]:
    return _make_auth_headers(test_operator, auth_service)


@pytest_asyncio.fixture
async def second_company_headers(
    second_company_user: tuple[Company, User],
    auth_service: AuthService,
) -> dict[str, str]:
    _, user = second_company_user
    return _make_auth_headers(user, auth_service)


# ---------------------------------------------------------------------------
# Standard criteria dict (matches CriteriaSchema)
# ---------------------------------------------------------------------------

SAMPLE_CRITERIA = {
    "required_skills": ["Python", "FastAPI", "PostgreSQL"],
    "bonus_skills": ["Docker", "Redis"],
    "min_experience_years": 3,
    "education": "bachelor",
    "industry_preference": ["Technology"],
    "languages": ["Chinese", "English"],
    "weights": {
        "skill_match": "high",
        "experience_match": "medium",
        "education": "low",
        "project_relevance": "medium",
        "overall_quality": "low",
    },
    "other_requirements": "良好的沟通能力",
}

EMPTY_CRITERIA = {
    "required_skills": [],
    "bonus_skills": [],
    "min_experience_years": None,
    "education": None,
    "industry_preference": [],
    "languages": [],
    "weights": {
        "skill_match": "medium",
        "experience_match": "medium",
        "education": "medium",
        "project_relevance": "medium",
        "overall_quality": "medium",
    },
    "other_requirements": None,
}


# ---------------------------------------------------------------------------
# Job-requirement fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def sample_job(
    db_session: AsyncSession,
    test_company: Company,
    test_user: User,
) -> JobRequirement:
    job = JobRequirement(
        title="Senior Python Developer",
        description="We are looking for an experienced Python developer.",
        company_id=test_company.id,
        created_by=test_user.id,
        status=JobRequirementStatus.ACTIVE,
        criteria=SAMPLE_CRITERIA,
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)
    return job


@pytest_asyncio.fixture
async def sample_draft_job(
    db_session: AsyncSession,
    test_company: Company,
    test_user: User,
) -> JobRequirement:
    job = JobRequirement(
        title="Draft Position",
        description="A draft job posting.",
        company_id=test_company.id,
        created_by=test_user.id,
        status=JobRequirementStatus.DRAFT,
        criteria=SAMPLE_CRITERIA,
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)
    return job


# ---------------------------------------------------------------------------
# Resume fixture
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def sample_resume(
    db_session: AsyncSession,
    sample_job: JobRequirement,
    test_user: User,
) -> Resume:
    resume = Resume(
        job_requirement_id=sample_job.id,
        file_name="zhangsan_resume.pdf",
        file_path="/tmp/test_resume.pdf",
        file_type=ResumeFileType.PDF,
        file_size=1024,
        parse_status=ParseStatus.SUCCESS,
        candidate_name="张三",
        candidate_email="zhangsan@example.com",
        candidate_phone="13800138000",
        parsed_data={
            "name": "张三",
            "email": "zhangsan@example.com",
            "phone": "13800138000",
            "skills": ["Python", "FastAPI", "Docker", "Redis"],
            "education": [
                {
                    "school": "清华大学",
                    "degree": "硕士",
                    "major": "计算机科学",
                    "start_date": None,
                    "end_date": None,
                }
            ],
            "work_experience": [
                {
                    "company": "ABC Tech",
                    "position": "Senior Developer",
                    "start_date": None,
                    "end_date": None,
                    "description": "5 years backend development",
                }
            ],
            "projects": [
                {
                    "name": "E-commerce Platform",
                    "role": "Lead Developer",
                    "description": "Built a high-concurrency e-commerce system",
                }
            ],
        },
        uploaded_by=test_user.id,
    )
    db_session.add(resume)
    await db_session.commit()
    await db_session.refresh(resume)
    return resume


# ---------------------------------------------------------------------------
# Mock AI analysis response dict
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_ai_response() -> dict:
    return {
        "skill_match": {
            "score": 90,
            "analysis": "候选人掌握了Python、FastAPI等核心技能，同时具备Docker和Redis等加分技能。",
            "matched_skills": ["Python", "FastAPI"],
            "missing_skills": ["PostgreSQL"],
            "bonus_skills_matched": ["Docker", "Redis"],
        },
        "experience_match": {
            "score": 80,
            "analysis": "候选人有5年工作经验，超过3年的最低要求。",
            "years_of_experience": 5,
            "relevant_years": 4,
        },
        "education": {
            "score": 85,
            "analysis": "候选人拥有计算机科学硕士学位，超过本科学历要求。",
            "degree_match": True,
        },
        "project_relevance": {
            "score": 75,
            "analysis": "候选人的电商项目经验与岗位有一定相关性。",
            "relevant_projects": 1,
        },
        "overall_quality": {
            "score": 82,
            "analysis": "简历结构清晰，内容完整，展现了较好的专业素养。",
        },
        "strengths": [
            "核心技能完全匹配",
            "加分技能覆盖率高",
            "学历超过岗位要求",
        ],
        "weaknesses": [
            "缺少PostgreSQL经验",
            "项目经验与岗位匹配度一般",
        ],
    }


# ---------------------------------------------------------------------------
# Analysis result fixture (with dimension scores)
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def sample_analysis(
    db_session: AsyncSession,
    sample_resume: Resume,
    sample_job: JobRequirement,
) -> AnalysisResult:
    analysis = AnalysisResult(
        resume_id=sample_resume.id,
        job_requirement_id=sample_job.id,
        overall_score=82.5,
        recommendation=RecommendationLevel.STRONGLY_RECOMMENDED,
        recommendation_reason="综合评分82.5分，技能和经验匹配度高",
        strengths=["核心技能完全匹配", "加分技能覆盖率高", "学历超过岗位要求"],
        weaknesses=["缺少PostgreSQL经验", "项目经验与岗位匹配度一般"],
        analysis_status=AnalysisStatus.COMPLETED,
        analyzed_at=datetime.now(timezone.utc),
    )
    db_session.add(analysis)
    await db_session.flush()

    # Create dimension scores
    dims = [
        DimensionScore(
            analysis_id=analysis.id,
            dimension=Dimension.SKILL_MATCH,
            score=90.0,
            weight="high",
            analysis_text="候选人掌握了Python、FastAPI等核心技能。",
            match_details={
                "matched_skills": ["Python", "FastAPI"],
                "missing_skills": ["PostgreSQL"],
                "bonus_skills_matched": ["Docker", "Redis"],
            },
        ),
        DimensionScore(
            analysis_id=analysis.id,
            dimension=Dimension.EXPERIENCE_MATCH,
            score=80.0,
            weight="medium",
            analysis_text="候选人有5年工作经验。",
            match_details=None,
        ),
        DimensionScore(
            analysis_id=analysis.id,
            dimension=Dimension.EDUCATION,
            score=85.0,
            weight="low",
            analysis_text="计算机科学硕士学位。",
            match_details=None,
        ),
        DimensionScore(
            analysis_id=analysis.id,
            dimension=Dimension.PROJECT_RELEVANCE,
            score=75.0,
            weight="medium",
            analysis_text="电商项目经验有一定相关性。",
            match_details=None,
        ),
        DimensionScore(
            analysis_id=analysis.id,
            dimension=Dimension.OVERALL_QUALITY,
            score=82.0,
            weight="low",
            analysis_text="简历结构清晰，内容完整。",
            match_details=None,
        ),
    ]
    for ds in dims:
        db_session.add(ds)

    await db_session.commit()
    await db_session.refresh(analysis)
    return analysis
