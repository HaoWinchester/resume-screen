import pytest
from sqlalchemy import select

from app.models import Resume, ParseStatus


pytestmark = pytest.mark.asyncio


async def test_channel_import_requires_consent(async_client, auth_headers, sample_job):
    response = await async_client.post(
        "/api/v1/channels/candidates/import",
        headers=auth_headers,
        json={
            "job_requirement_id": str(sample_job.id),
            "source_platform": "boss_zhipin",
            "consent_confirmed": False,
            "candidates": [
                {
                    "content": "张三 Python FastAPI PostgreSQL Docker 5年后端开发经验 13800138000",
                }
            ],
        },
    )

    assert response.status_code == 422


async def test_channel_import_creates_parsed_resume(
    async_client,
    auth_headers,
    sample_job,
    db_session,
    monkeypatch,
):
    dispatched: list[tuple[str, str]] = []

    def fake_dispatch(resume_id: str, job_requirement_id: str) -> str:
        dispatched.append((resume_id, job_requirement_id))
        return "test"

    monkeypatch.setattr("app.api.channels.dispatch_resume_analysis", fake_dispatch)

    response = await async_client.post(
        "/api/v1/channels/candidates/import",
        headers=auth_headers,
        json={
            "job_requirement_id": str(sample_job.id),
            "source_platform": "boss_zhipin",
            "consent_confirmed": True,
            "candidates": [
                {
                    "candidate_name": "李雷",
                    "source_url": "https://example.com/authorized-candidate/1",
                    "content_format": "html",
                    "content": """
                        <html><body>
                        <h1>李雷</h1>
                        <p>电话 13800138000 邮箱 lilei@example.com</p>
                        <p>Python FastAPI PostgreSQL Docker Redis，5年后端开发经验。</p>
                        </body></html>
                    """,
                }
            ],
        },
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["total_imported"] == 1
    assert payload["total_failed"] == 0
    assert payload["imported"][0]["candidate_name"] == "李雷"
    assert dispatched == [(payload["imported"][0]["resume_id"], str(sample_job.id))]

    result = await db_session.execute(select(Resume))
    resume = result.scalar_one()
    assert resume.parse_status == ParseStatus.SUCCESS
    assert resume.candidate_name == "李雷"
    assert resume.candidate_email == "lilei@example.com"
    assert resume.parsed_data["source"]["platform"] == "boss_zhipin"
    assert "Python" in resume.parsed_data["skills"]


async def test_channel_import_file_creates_multiple_resumes(
    async_client,
    auth_headers,
    sample_job,
    db_session,
    monkeypatch,
):
    dispatched: list[tuple[str, str]] = []

    def fake_dispatch(resume_id: str, job_requirement_id: str) -> str:
        dispatched.append((resume_id, job_requirement_id))
        return "test"

    monkeypatch.setattr("app.api.channels.dispatch_resume_analysis", fake_dispatch)

    csv_body = (
        "candidate_name,source_url,content\n"
        "王五,https://example.com/authorized/1,\"王五 13800138002 wangwu@example.com Python FastAPI Docker 6年经验\"\n"
        "赵六,https://example.com/authorized/2,\"赵六 13800138003 zhaoliu@example.com PostgreSQL Redis 4年经验\"\n"
    )

    response = await async_client.post(
        "/api/v1/channels/candidates/import-file",
        headers=auth_headers,
        data={
            "job_requirement_id": str(sample_job.id),
            "source_platform": "boss_zhipin",
            "consent_confirmed": "true",
        },
        files={"file": ("candidates.csv", csv_body.encode("utf-8-sig"), "text/csv")},
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["total_imported"] == 2
    assert payload["total_failed"] == 0
    assert len(dispatched) == 2

    result = await db_session.execute(select(Resume).order_by(Resume.candidate_name.asc()))
    resumes = result.scalars().all()
    assert [resume.candidate_name for resume in resumes] == ["王五", "赵六"]
    assert all(resume.parse_status == ParseStatus.SUCCESS for resume in resumes)
