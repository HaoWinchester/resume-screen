"""Tests for the /api/v1/job-requirements endpoints."""

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import SAMPLE_CRITERIA, EMPTY_CRITERIA


pytestmark = pytest.mark.asyncio


def _criteria_payload():
    """Return a fresh criteria dict suitable for POST/PUT."""
    return {
        "required_skills": ["Python", "React"],
        "bonus_skills": ["Docker"],
        "min_experience_years": 2,
        "education": "bachelor",
        "industry_preference": ["Technology"],
        "languages": ["English"],
        "weights": {
            "skill_match": "high",
            "experience_match": "medium",
            "education": "low",
            "project_relevance": "medium",
            "overall_quality": "low",
        },
        "other_requirements": None,
    }


class TestCreateJobRequirement:
    """POST /api/v1/job-requirements"""

    async def test_create_job_requirement(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        payload = {
            "title": "Backend Developer",
            "description": "Build APIs",
            "criteria": _criteria_payload(),
        }
        resp = await async_client.post(
            "/api/v1/job-requirements",
            json=payload,
            headers=auth_headers,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["title"] == "Backend Developer"
        assert body["description"] == "Build APIs"
        assert body["status"] == "draft"
        assert body["resume_count"] == 0
        assert body["analyzed_count"] == 0
        assert "id" in body
        assert "created_at" in body

    async def test_create_unauthenticated(self, async_client: AsyncClient):
        payload = {
            "title": "No Auth",
            "criteria": _criteria_payload(),
        }
        resp = await async_client.post(
            "/api/v1/job-requirements", json=payload
        )
        assert resp.status_code == 403 or resp.status_code == 401


class TestListJobRequirements:
    """GET /api/v1/job-requirements"""

    async def test_list_job_requirements(
        self, async_client: AsyncClient, auth_headers: dict, sample_job
    ):
        resp = await async_client.get(
            "/api/v1/job-requirements", headers=auth_headers
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert body["total"] >= 1
        assert body["page"] == 1

    async def test_list_job_requirements_filter_by_status(
        self, async_client: AsyncClient, auth_headers: dict, sample_job, sample_draft_job
    ):
        resp = await async_client.get(
            "/api/v1/job-requirements?status_filter=active",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert all(item["status"] == "active" for item in body["items"])


class TestGetJobRequirementDetail:
    """GET /api/v1/job-requirements/{job_id}"""

    async def test_get_job_requirement_detail(
        self, async_client: AsyncClient, auth_headers: dict, sample_job
    ):
        resp = await async_client.get(
            f"/api/v1/job-requirements/{sample_job.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == str(sample_job.id)
        assert body["title"] == "Senior Python Developer"
        assert "criteria" in body
        assert "required_skills" in body["criteria"]

    async def test_get_nonexistent_job(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        fake_id = str(uuid.uuid4())
        resp = await async_client.get(
            f"/api/v1/job-requirements/{fake_id}",
            headers=auth_headers,
        )
        assert resp.status_code == 404


class TestUpdateJobRequirement:
    """PATCH /api/v1/job-requirements/{job_id}"""

    async def test_update_job_requirement(
        self, async_client: AsyncClient, auth_headers: dict, sample_draft_job
    ):
        resp = await async_client.patch(
            f"/api/v1/job-requirements/{sample_draft_job.id}",
            json={"title": "Updated Title"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["title"] == "Updated Title"


class TestDeleteJobRequirement:
    """DELETE /api/v1/job-requirements/{job_id}"""

    async def test_delete_draft_job(
        self, async_client: AsyncClient, auth_headers: dict, sample_draft_job
    ):
        resp = await async_client.delete(
            f"/api/v1/job-requirements/{sample_draft_job.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 204

    async def test_delete_active_job_fails(
        self, async_client: AsyncClient, auth_headers: dict, sample_job
    ):
        resp = await async_client.delete(
            f"/api/v1/job-requirements/{sample_job.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 400


class TestActivateJob:
    """POST /api/v1/job-requirements/{job_id}/activate"""

    async def test_activate_job(
        self, async_client: AsyncClient, auth_headers: dict, sample_draft_job
    ):
        resp = await async_client.post(
            f"/api/v1/job-requirements/{sample_draft_job.id}/activate",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "active"

    async def test_activate_empty_criteria_fails(
        self, async_client: AsyncClient, db_session, test_company, test_user, auth_headers
    ):
        from app.models import JobRequirement, JobRequirementStatus

        job = JobRequirement(
            title="Empty Job",
            description="No criteria",
            company_id=test_company.id,
            created_by=test_user.id,
            status=JobRequirementStatus.DRAFT,
            criteria=EMPTY_CRITERIA,
        )
        db_session.add(job)
        await db_session.commit()
        await db_session.refresh(job)

        resp = await async_client.post(
            f"/api/v1/job-requirements/{job.id}/activate",
            headers=auth_headers,
        )
        assert resp.status_code == 422


class TestCloseJob:
    """POST /api/v1/job-requirements/{job_id}/close"""

    async def test_close_job(
        self, async_client: AsyncClient, auth_headers: dict, sample_job
    ):
        resp = await async_client.post(
            f"/api/v1/job-requirements/{sample_job.id}/close",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "closed"


class TestCopyJobRequirement:
    """POST /api/v1/job-requirements/{job_id}/copy"""

    async def test_copy_job_requirement(
        self, async_client: AsyncClient, auth_headers: dict, sample_job
    ):
        resp = await async_client.post(
            f"/api/v1/job-requirements/{sample_job.id}/copy",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["title"].endswith("(副本)")
        assert body["status"] == "draft"
        assert body["id"] != str(sample_job.id)


class TestJobIsolation:
    """Cross-company isolation for job requirements."""

    async def test_job_isolation_across_companies(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        second_company_headers: dict,
        sample_job,
    ):
        # Company A sees the job
        resp_a = await async_client.get(
            f"/api/v1/job-requirements/{sample_job.id}",
            headers=auth_headers,
        )
        assert resp_a.status_code == 200

        # Company B cannot see it
        resp_b = await async_client.get(
            f"/api/v1/job-requirements/{sample_job.id}",
            headers=second_company_headers,
        )
        assert resp_b.status_code == 404

        # Company B cannot list it
        resp_b_list = await async_client.get(
            "/api/v1/job-requirements",
            headers=second_company_headers,
        )
        assert resp_b_list.status_code == 200
        assert resp_b_list.json()["total"] == 0
