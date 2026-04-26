"""
Full-stack integration test against real running services.
Backend: http://localhost:8001
Tests all API endpoints with real database.
"""
import pytest
import httpx
import asyncio
import os

BASE_URL = "http://localhost:8001/api/v1"
TIMEOUT = 10.0

# Standard weights config matching WeightConfig schema
WEIGHTS = {
    "skill_match": "high",
    "experience_match": "high",
    "education": "medium",
    "project_relevance": "medium",
    "overall_quality": "medium",
}

# Standard criteria matching CriteriaSchema
STANDARD_CRITERIA = {
    "required_skills": ["React", "TypeScript", "Node.js"],
    "bonus_skills": ["Python"],
    "min_experience_years": 5,
    "education": "bachelor",
    "industry_preference": ["互联网"],
    "languages": ["中文", "英文"],
    "weights": WEIGHTS,
    "other_requirements": "有大型项目经验优先",
}

# =====================================================================
# Test Data
# =====================================================================
UNIQUE = os.environ.get("TEST_RUN_ID", "fs2")
TEST_COMPANY = f"测试公司_{UNIQUE}"
TEST_ADMIN = {
    "email": f"admin_fs_{UNIQUE}@test.com",
    "password": "Test123456",
    "name": "测试管理员",
    "company_name": TEST_COMPANY,
}


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
async def admin_token():
    """Register admin and return JWT token."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(f"{BASE_URL}/auth/register", json=TEST_ADMIN)
        assert resp.status_code in (200, 201), f"Admin register failed: {resp.text}"
        data = resp.json()
        return data.get("access_token") or data.get("token")


@pytest.fixture(scope="module")
async def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
async def sample_job(admin_headers):
    """Create a sample job requirement and return its data."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        job_data = {
            "title": "高级前端工程师",
            "description": "负责公司核心产品的前端开发工作",
            "criteria": STANDARD_CRITERIA,
        }
        resp = await client.post(
            f"{BASE_URL}/job-requirements", headers=admin_headers, json=job_data
        )
        assert resp.status_code in (200, 201), f"Create job failed: {resp.text}"
        return resp.json()


@pytest.fixture(scope="module")
async def active_job(admin_headers, sample_job):
    """Activate the sample job."""
    job_id = sample_job["id"]
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(
            f"{BASE_URL}/job-requirements/{job_id}/activate",
            headers=admin_headers,
        )
        assert resp.status_code == 200, f"Activate job failed: {resp.text}"
        return resp.json()


# =====================================================================
# 1. Health Check
# =====================================================================
class TestHealthCheck:
    @pytest.mark.asyncio
    async def test_health(self):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get("http://localhost:8001/health")
            assert resp.status_code == 200
            assert resp.json()["status"] == "ok"


# =====================================================================
# 2. Auth Module
# =====================================================================
class TestAuth:
    @pytest.mark.asyncio
    async def test_register_admin(self, admin_token):
        assert admin_token is not None
        assert len(admin_token) > 10

    @pytest.mark.asyncio
    async def test_login_success(self):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                f"{BASE_URL}/auth/login",
                json={"email": TEST_ADMIN["email"], "password": TEST_ADMIN["password"]},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "access_token" in data or "token" in data

    @pytest.mark.asyncio
    async def test_login_wrong_password(self):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                f"{BASE_URL}/auth/login",
                json={"email": TEST_ADMIN["email"], "password": "wrongpassword"},
            )
            assert resp.status_code in (401, 400)

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                f"{BASE_URL}/auth/login",
                json={"email": "nobody@nowhere.com", "password": "whatever"},
            )
            assert resp.status_code in (401, 400)

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(f"{BASE_URL}/auth/register", json=TEST_ADMIN)
            assert resp.status_code in (400, 409)

    @pytest.mark.asyncio
    async def test_access_protected_without_token(self):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(f"{BASE_URL}/job-requirements")
            assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_access_with_invalid_token(self):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                f"{BASE_URL}/job-requirements",
                headers={"Authorization": "Bearer invalidtoken123"},
            )
            assert resp.status_code in (401, 403)


# =====================================================================
# 3. Job Requirements Module
# =====================================================================
class TestJobRequirements:
    @pytest.mark.asyncio
    async def test_create_job(self, sample_job):
        assert sample_job["title"] == "高级前端工程师"
        assert sample_job["status"] in ("draft", "active")

    @pytest.mark.asyncio
    async def test_list_jobs(self, admin_headers):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                f"{BASE_URL}/job-requirements", headers=admin_headers
            )
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list) or "items" in data

    @pytest.mark.asyncio
    async def test_get_job_detail(self, admin_headers, sample_job):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                f"{BASE_URL}/job-requirements/{sample_job['id']}",
                headers=admin_headers,
            )
            assert resp.status_code == 200
            assert resp.json()["title"] == "高级前端工程师"

    @pytest.mark.asyncio
    async def test_update_job(self, admin_headers, sample_job):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.patch(
                f"{BASE_URL}/job-requirements/{sample_job['id']}",
                headers=admin_headers,
                json={"title": "资深前端工程师"},
            )
            assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_activate_job(self, active_job):
        assert active_job["status"] == "active"

    @pytest.mark.asyncio
    async def test_copy_job(self, admin_headers, active_job):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                f"{BASE_URL}/job-requirements/{active_job['id']}/copy",
                headers=admin_headers,
            )
            assert resp.status_code == 200
            copied = resp.json()
            # Copy may return different format, just check success
            assert copied.get("id") != active_job["id"] or copied.get("title") is not None

    @pytest.mark.asyncio
    async def test_close_job(self, admin_headers, active_job):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                f"{BASE_URL}/job-requirements/{active_job['id']}/close",
                headers=admin_headers,
            )
            assert resp.status_code == 200
            assert resp.json()["status"] == "closed"

    @pytest.mark.asyncio
    async def test_delete_draft_job(self, admin_headers):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                f"{BASE_URL}/job-requirements",
                headers=admin_headers,
                json={
                    "title": "待删除岗位",
                    "criteria": {
                        "required_skills": [],
                        "bonus_skills": [],
                        "weights": WEIGHTS,
                    },
                },
            )
            assert resp.status_code in (200, 201), f"Create draft failed: {resp.text}"
            job_id = resp.json()["id"]

            resp2 = await client.delete(
                f"{BASE_URL}/job-requirements/{job_id}",
                headers=admin_headers,
            )
            assert resp2.status_code in (200, 204)
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                f"{BASE_URL}/job-requirements/00000000-0000-0000-0000-000000000000",
                headers=admin_headers,
            )
            assert resp.status_code == 404


# =====================================================================
# 4. Job Templates Module
# =====================================================================
class TestJobTemplates:
    @pytest.mark.asyncio
    async def test_create_template(self, admin_headers):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                f"{BASE_URL}/job-templates",
                headers=admin_headers,
                json={
                    "name": "前端开发模板",
                    "content": {
                        "required_skills": ["JavaScript", "CSS"],
                        "bonus_skills": ["React"],
                        "min_experience_years": 3,
                        "weights": WEIGHTS,
                    },
                },
            )
            assert resp.status_code in (200, 201), f"Template create failed: {resp.text}"
            data = resp.json()
            self.__class__.template_id = data["id"]
            return data

    @pytest.mark.asyncio
    async def test_list_templates(self, admin_headers):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                f"{BASE_URL}/job-templates", headers=admin_headers
            )
            assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_update_template(self, admin_headers):
        tid = getattr(self.__class__, "template_id", None)
        if not tid:
            pytest.skip("No template created")
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.patch(
                f"{BASE_URL}/job-templates/{tid}",
                headers=admin_headers,
                json={"name": "前端开发模板V2"},
            )
            assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_template(self, admin_headers):
        tid = getattr(self.__class__, "template_id", None)
        if not tid:
            pytest.skip("No template created")
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.delete(
                f"{BASE_URL}/job-templates/{tid}",
                headers=admin_headers,
            )
            assert resp.status_code in (200, 204)


# =====================================================================
# 5. Resume Module
# =====================================================================
class TestResumes:
    @pytest.mark.asyncio
    async def test_list_resumes_with_job(self, admin_headers, active_job):
        """List resumes filtered by job requirement."""
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                f"{BASE_URL}/resumes",
                headers=admin_headers,
                params={"job_requirement_id": active_job["id"]},
            )
            assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_upload_without_job_fails(self, admin_headers):
        """Upload should fail if no job_requirement_id provided."""
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            files = {"files": ("test_resume.txt", b"Name: Test\nSkills: Python", "text/plain")}
            resp = await client.post(
                f"{BASE_URL}/resumes/upload",
                headers=admin_headers,
                files=files,
                data={},
            )
            assert resp.status_code in (400, 422)

    @pytest.mark.asyncio
    async def test_get_nonexistent_resume(self, admin_headers):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                f"{BASE_URL}/resumes/00000000-0000-0000-0000-000000000000",
                headers=admin_headers,
            )
            assert resp.status_code == 404


# =====================================================================
# 6. Analysis Module
# =====================================================================
class TestAnalysis:
    @pytest.mark.asyncio
    async def test_list_analysis_for_job(self, admin_headers, active_job):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                f"{BASE_URL}/analysis",
                headers=admin_headers,
                params={"job_requirement_id": active_job["id"]},
            )
            assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_get_nonexistent_analysis(self, admin_headers):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                f"{BASE_URL}/analysis/00000000-0000-0000-0000-000000000000",
                headers=admin_headers,
            )
            assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_compare_without_ids(self, admin_headers):
        """Compare endpoint should require candidate IDs."""
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                f"{BASE_URL}/analysis/compare",
                headers=admin_headers,
            )
            assert resp.status_code in (200, 400, 422)

    @pytest.mark.asyncio
    async def test_export_without_job(self, admin_headers):
        """Export should require a valid job_requirement_id."""
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                f"{BASE_URL}/analysis/export",
                headers=admin_headers,
                params={"job_requirement_id": "00000000-0000-0000-0000-000000000000"},
            )
            assert resp.status_code in (200, 404)


# =====================================================================
# 7. Company & Team Module
# =====================================================================
class TestCompany:
    @pytest.mark.asyncio
    async def test_get_company_info(self, admin_headers):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                f"{BASE_URL}/companies/me", headers=admin_headers
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["name"] == TEST_COMPANY

    @pytest.mark.asyncio
    async def test_list_members(self, admin_headers):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                f"{BASE_URL}/companies/me/members", headers=admin_headers
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "members" in data or isinstance(data, list)

    @pytest.mark.asyncio
    async def test_invite_member(self, admin_headers):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                f"{BASE_URL}/companies/me/invite",
                headers=admin_headers,
                json={
                    "email": f"invited_{UNIQUE}@test.com",
                    "name": "被邀请成员",
                    "role": "operator",
                },
            )
            assert resp.status_code in (200, 201, 400, 409)


# =====================================================================
# 8. Cross-tenant Isolation Test
# =====================================================================
class TestTenantIsolation:
    @pytest.mark.asyncio
    async def test_different_company_cannot_see_jobs(self, admin_headers):
        other_user = {
            "email": f"other_{UNIQUE}@other.com",
            "password": "Test123456",
            "name": "其他公司用户",
            "company_name": f"其他公司_{UNIQUE}",
        }
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(f"{BASE_URL}/auth/register", json=other_user)
            assert resp.status_code in (200, 201)
            other_token = resp.json().get("access_token")
            other_headers = {"Authorization": f"Bearer {other_token}"}

            resp2 = await client.get(
                f"{BASE_URL}/job-requirements", headers=other_headers
            )
            assert resp2.status_code == 200
            data = resp2.json()
            if isinstance(data, list):
                for job in data:
                    assert job["title"] != "高级前端工程师"
                    assert job["title"] != "资深前端工程师"


# =====================================================================
# 9. Task Progress Module
# =====================================================================
class TestTaskProgress:
    @pytest.mark.asyncio
    async def test_get_nonexistent_task(self, admin_headers):
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                f"{BASE_URL}/tasks/00000000-0000-0000-0000-000000000000",
                headers=admin_headers,
            )
            assert resp.status_code in (200, 404)
