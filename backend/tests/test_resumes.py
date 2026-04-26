"""Tests for the /api/v1/resumes endpoints."""

import uuid
from io import BytesIO

import pytest
from httpx import AsyncClient
from unittest.mock import MagicMock

from app.models import (
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


pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_pdf_file(filename: str = "test.pdf") -> tuple[BytesIO, str, str]:
    """Return (file_like, filename, content_type) for a minimal PDF."""
    # Minimal valid PDF bytes (header is enough for format detection)
    content = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n109\n%%EOF"
    return BytesIO(content), filename, "application/pdf"


def _make_txt_file(filename: str = "bad.txt") -> tuple[BytesIO, str, str]:
    content = b"This is plain text, not a resume format."
    return BytesIO(content), filename, "text/plain"


# ---------------------------------------------------------------------------
# Upload tests
# ---------------------------------------------------------------------------

class TestUploadResume:
    """POST /api/v1/resumes/upload"""

    async def test_upload_single_pdf(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        sample_job: JobRequirement,
        mocker,
    ):
        # Mock async dispatch and StorageService.save_file
        mocker.patch("app.api.resumes.dispatch_resume_parse", return_value="local")
        mocker.patch(
            "app.api.resumes.StorageService.save_file",
            return_value=("/tmp/test_resume.pdf", ".pdf", len(b"fake")),
        )
        mocker.patch(
            "app.api.resumes.StorageService.validate_file",
            return_value=(True, ".pdf", None),
        )

        file_bytes, filename, content_type = _make_pdf_file()
        resp = await async_client.post(
            "/api/v1/resumes/upload",
            headers=auth_headers,
            data={"job_requirement_id": str(sample_job.id)},
            files={"files": (filename, file_bytes, content_type)},
        )
        assert resp.status_code == 202
        body = resp.json()
        assert body["job_requirement_id"] == str(sample_job.id)
        assert body["total_uploaded"] == 1
        assert body["total_failed"] == 0
        assert body["uploaded"][0]["parse_status"] == "pending"

    async def test_upload_batch(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        sample_job: JobRequirement,
        mocker,
    ):
        mocker.patch("app.api.resumes.dispatch_resume_parse", return_value="local")
        mocker.patch(
            "app.api.resumes.StorageService.save_file",
            return_value=("/tmp/resume.pdf", ".pdf", 100),
        )
        mocker.patch(
            "app.api.resumes.StorageService.validate_file",
            return_value=(True, ".pdf", None),
        )

        files_to_upload = []
        for i in range(3):
            fb, fn, ct = _make_pdf_file(f"resume_{i}.pdf")
            files_to_upload.append(("files", (fn, fb, ct)))

        resp = await async_client.post(
            "/api/v1/resumes/upload",
            headers=auth_headers,
            data={"job_requirement_id": str(sample_job.id)},
            files=files_to_upload,
        )
        assert resp.status_code == 202
        body = resp.json()
        assert body["total_uploaded"] == 3

    async def test_upload_invalid_format_txt(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        sample_job: JobRequirement,
        mocker,
    ):
        mocker.patch(
            "app.api.resumes.StorageService.validate_file",
            return_value=(False, None, "不支持的文件类型"),
        )

        file_bytes, filename, content_type = _make_txt_file()
        resp = await async_client.post(
            "/api/v1/resumes/upload",
            headers=auth_headers,
            data={"job_requirement_id": str(sample_job.id)},
            files={"files": (filename, file_bytes, content_type)},
        )
        assert resp.status_code == 202
        body = resp.json()
        assert body["total_failed"] == 1
        assert body["total_uploaded"] == 0

    async def test_upload_to_closed_job(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        db_session,
        test_company,
        test_user,
    ):
        from tests.conftest import SAMPLE_CRITERIA

        job = JobRequirement(
            title="Closed Job",
            description="Closed",
            company_id=test_company.id,
            created_by=test_user.id,
            status=JobRequirementStatus.CLOSED,
            criteria=SAMPLE_CRITERIA,
        )
        db_session.add(job)
        await db_session.commit()
        await db_session.refresh(job)

        file_bytes, filename, ct = _make_pdf_file()
        resp = await async_client.post(
            "/api/v1/resumes/upload",
            headers=auth_headers,
            data={"job_requirement_id": str(job.id)},
            files={"files": (filename, file_bytes, ct)},
        )
        assert resp.status_code == 400

    async def test_upload_to_nonexistent_job(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
    ):
        file_bytes, filename, ct = _make_pdf_file()
        resp = await async_client.post(
            "/api/v1/resumes/upload",
            headers=auth_headers,
            data={"job_requirement_id": str(uuid.uuid4())},
            files={"files": (filename, file_bytes, ct)},
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# List tests
# ---------------------------------------------------------------------------

class TestListResumes:
    """GET /api/v1/resumes"""

    async def test_list_resumes_paginated(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        sample_job: JobRequirement,
        sample_resume: Resume,
    ):
        resp = await async_client.get(
            f"/api/v1/resumes?job_requirement_id={sample_job.id}&page=1&per_page=10",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert body["total"] >= 1
        assert body["page"] == 1

    async def test_list_resumes_filter_by_status(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        sample_job: JobRequirement,
        sample_resume: Resume,
    ):
        resp = await async_client.get(
            f"/api/v1/resumes?job_requirement_id={sample_job.id}&parse_status=success",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        for item in body["items"]:
            assert item["parse_status"] == "success"

    async def test_list_resumes_falls_back_to_parsed_basic_info(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        db_session,
        sample_job: JobRequirement,
        test_user,
    ):
        resume = Resume(
            job_requirement_id=sample_job.id,
            file_name="menghao_resume.pdf",
            file_path="/tmp/menghao_resume.pdf",
            file_type=ResumeFileType.PDF,
            file_size=1024,
            parse_status=ParseStatus.SUCCESS,
            candidate_name=None,
            candidate_email=None,
            candidate_phone=None,
            parsed_data={
                "name": "姓名",
                "raw_text": "简历信息表\n一、基本信息\n姓名\n孟浩\n性别\n男\n年龄\n32\n联系方式\n18375312286",
            },
            uploaded_by=test_user.id,
        )
        db_session.add(resume)
        await db_session.commit()

        resp = await async_client.get(
            f"/api/v1/resumes?job_requirement_id={sample_job.id}&page=1&per_page=50",
            headers=auth_headers,
        )

        assert resp.status_code == 200
        items = resp.json()["items"]
        item = next(item for item in items if item["id"] == str(resume.id))
        assert item["candidate_name"] == "孟浩"
        assert item["candidate_phone"] == "18375312286"

    async def test_list_resumes_missing_job_id(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
    ):
        resp = await async_client.get(
            "/api/v1/resumes",
            headers=auth_headers,
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Detail tests
# ---------------------------------------------------------------------------

class TestGetResumeDetail:
    """GET /api/v1/resumes/{resume_id}"""

    async def test_get_resume_detail(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        sample_resume: Resume,
    ):
        resp = await async_client.get(
            f"/api/v1/resumes/{sample_resume.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == str(sample_resume.id)
        assert body["file_name"] == "zhangsan_resume.pdf"
        assert "parsed_data" in body
        assert body["parsed_data"]["name"] == "张三"

    async def test_get_nonexistent_resume(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
    ):
        resp = await async_client.get(
            f"/api/v1/resumes/{uuid.uuid4()}",
            headers=auth_headers,
        )
        assert resp.status_code == 404


class TestRetryResumeParse:
    """POST /api/v1/resumes/{resume_id}/retry"""

    async def test_retry_resume_parse_resets_resume_and_analysis(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        db_session,
        sample_resume: Resume,
        sample_job: JobRequirement,
        mocker,
    ):
        mock_dispatch = mocker.patch("app.api.resumes.dispatch_resume_parse", return_value="local")

        analysis = AnalysisResult(
            resume_id=sample_resume.id,
            job_requirement_id=sample_job.id,
            overall_score=88.0,
            recommendation=RecommendationLevel.RECOMMENDED,
            recommendation_reason="初始结果",
            strengths=["沟通好"],
            weaknesses=["技能略少"],
            analysis_status=AnalysisStatus.COMPLETED,
        )
        db_session.add(analysis)
        await db_session.flush()

        dimension_score = DimensionScore(
            analysis_id=analysis.id,
            dimension=Dimension.SKILL_MATCH,
            score=85.0,
            weight="high",
            analysis_text="技能匹配良好",
            match_details={"matched_skills": ["Python"]},
        )
        db_session.add(dimension_score)

        sample_resume.parse_status = ParseStatus.FAILED
        sample_resume.parse_error = "旧错误"
        sample_resume.parsed_data = {"name": "张三"}
        sample_resume.candidate_name = "张三"
        sample_resume.candidate_email = "zhangsan@example.com"
        sample_resume.candidate_phone = "13800000000"
        await db_session.commit()

        resp = await async_client.post(
            f"/api/v1/resumes/{sample_resume.id}/retry",
            headers=auth_headers,
        )

        assert resp.status_code == 202
        assert resp.json()["parse_status"] == "pending"

        await db_session.refresh(sample_resume)
        await db_session.refresh(analysis)

        assert sample_resume.parse_status == ParseStatus.PENDING
        assert sample_resume.parse_error is None
        assert sample_resume.parsed_data is None
        assert sample_resume.candidate_name is None
        assert analysis.analysis_status == AnalysisStatus.PENDING
        assert float(analysis.overall_score) == 0.0
        assert analysis.recommendation == RecommendationLevel.PENDING
        assert analysis.recommendation_reason is None
        assert analysis.analyzed_at is None

        remaining_scores = await db_session.get(DimensionScore, dimension_score.id)
        assert remaining_scores is None
        mock_dispatch.assert_called_once()


# ---------------------------------------------------------------------------
# Delete tests
# ---------------------------------------------------------------------------

class TestDeleteResume:
    """DELETE /api/v1/resumes/{resume_id}"""

    async def test_delete_resume(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        sample_resume: Resume,
        mocker,
    ):
        mocker.patch("app.api.resumes.StorageService.delete_file", return_value=True)
        resp = await async_client.delete(
            f"/api/v1/resumes/{sample_resume.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 204

    async def test_delete_nonexistent_resume(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
    ):
        resp = await async_client.delete(
            f"/api/v1/resumes/{uuid.uuid4()}",
            headers=auth_headers,
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Isolation tests
# ---------------------------------------------------------------------------

class TestResumeIsolation:
    """Cross-company isolation for resumes."""

    async def test_resume_isolation_across_companies(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        second_company_headers: dict,
        sample_resume: Resume,
        sample_job: JobRequirement,
    ):
        # Company A can see the resume
        resp_a = await async_client.get(
            f"/api/v1/resumes/{sample_resume.id}",
            headers=auth_headers,
        )
        assert resp_a.status_code == 200

        # Company B cannot see it
        resp_b = await async_client.get(
            f"/api/v1/resumes/{sample_resume.id}",
            headers=second_company_headers,
        )
        assert resp_b.status_code == 404
