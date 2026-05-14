"""Tests for the /api/v1/analysis endpoints."""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from app.models import (
    AnalysisResult,
    AnalysisStatus,
    RecommendationLevel,
    DimensionScore,
    Dimension,
    Resume,
    ResumeFileType,
    ParseStatus,
    JobRequirement,
    JobRequirementStatus,
)


pytestmark = pytest.mark.asyncio


class TestListAnalysisResults:
    """GET /api/v1/analysis"""

    async def test_list_analysis_results(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        sample_analysis: AnalysisResult,
        sample_job: JobRequirement,
    ):
        resp = await async_client.get(
            f"/api/v1/analysis?job_requirement_id={sample_job.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert "statistics" in body
        assert body["total"] >= 1

    async def test_list_analysis_paginates_candidates_not_dimension_rows(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        db_session,
        sample_analysis: AnalysisResult,
        sample_job: JobRequirement,
        test_user,
    ):
        for index in range(3):
            resume = Resume(
                job_requirement_id=sample_job.id,
                file_name=f"candidate-{index}.pdf",
                file_path=f"/tmp/candidate-{index}.pdf",
                file_type=ResumeFileType.PDF,
                file_size=1024,
                parse_status=ParseStatus.SUCCESS,
                candidate_name=f"候选人{index}",
                uploaded_by=test_user.id,
            )
            db_session.add(resume)
            await db_session.flush()

            analysis = AnalysisResult(
                resume_id=resume.id,
                job_requirement_id=sample_job.id,
                overall_score=80 + index,
                recommendation=RecommendationLevel.RECOMMENDED,
                analysis_status=AnalysisStatus.COMPLETED,
                analyzed_at=datetime.now(timezone.utc),
            )
            db_session.add(analysis)
            await db_session.flush()

            for dimension in Dimension:
                db_session.add(
                    DimensionScore(
                        analysis_id=analysis.id,
                        dimension=dimension,
                        score=80,
                        weight="medium",
                        analysis_text="维度说明",
                        match_details=None,
                    )
                )

        await db_session.commit()

        resp = await async_client.get(
            f"/api/v1/analysis?job_requirement_id={sample_job.id}&per_page=10",
            headers=auth_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 4
        assert len(body["items"]) == 4

    async def test_list_analysis_statistics(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        sample_analysis: AnalysisResult,
        sample_job: JobRequirement,
    ):
        resp = await async_client.get(
            f"/api/v1/analysis?job_requirement_id={sample_job.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        stats = resp.json()["statistics"]
        assert stats["total_resumes"] >= 1
        assert stats["analyzed"] >= 1
        assert isinstance(stats["average_score"], (int, float))

    async def test_list_analysis_missing_job_id(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
    ):
        resp = await async_client.get(
            "/api/v1/analysis",
            headers=auth_headers,
        )
        assert resp.status_code == 422


class TestResumeProgress:
    """GET /api/v1/analysis/progress"""

    async def test_resume_progress_uses_real_resume_counts(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        sample_resume: Resume,
    ):
        resp = await async_client.get(
            "/api/v1/analysis/progress?days=7",
            headers=auth_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        assert len(body["days"]) == 7
        assert body["total_uploaded"] >= 1
        assert body["total_parsed"] >= 1
        assert body["total_failed"] >= 0
        assert body["total_processing"] >= 0
        assert any(day["parsed"] >= 1 for day in body["days"])


class TestRecentActivity:
    """GET /api/v1/analysis/activity"""

    async def test_recent_activity_uses_real_resume_records(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        sample_resume: Resume,
    ):
        resp = await async_client.get(
            "/api/v1/analysis/activity?limit=4",
            headers=auth_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        assert len(body["items"]) >= 1
        first = body["items"][0]
        assert first["id"].startswith("resume-")
        assert first["title"] == "简历解析完成"
        assert sample_resume.candidate_name in first["description"]
        assert "occurred_at" in first


class TestGetAnalysisDetail:
    """GET /api/v1/analysis/{analysis_id}"""

    async def test_get_analysis_detail(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        sample_analysis: AnalysisResult,
    ):
        resp = await async_client.get(
            f"/api/v1/analysis/{sample_analysis.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == str(sample_analysis.id)
        assert "strengths" in body
        assert "weaknesses" in body
        assert "dimension_scores" in body
        assert "resume" in body
        assert "job_requirement" in body
        assert isinstance(body["strengths"], list)
        assert isinstance(body["weaknesses"], list)

    async def test_get_analysis_detail_includes_match_details(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        sample_analysis: AnalysisResult,
    ):
        resp = await async_client.get(
            f"/api/v1/analysis/{sample_analysis.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        dim_scores = body["dimension_scores"]
        assert len(dim_scores) == 5

        # skill_match should have match_details
        skill_dim = next(d for d in dim_scores if d["dimension"] == "skill_match")
        assert skill_dim["match_details"] is not None
        assert "matched_skills" in skill_dim["match_details"]

    async def test_get_nonexistent_analysis(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
    ):
        resp = await async_client.get(
            f"/api/v1/analysis/{uuid.uuid4()}",
            headers=auth_headers,
        )
        assert resp.status_code == 404


class TestRetryAnalysis:
    """POST /api/v1/analysis/{analysis_id}/retry"""

    async def test_retry_failed_analysis(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        db_session,
        sample_resume: Resume,
        sample_job: JobRequirement,
        mocker,
    ):
        mock_dispatch = mocker.patch(
            "app.api.analysis.dispatch_resume_analysis",
            return_value="local",
        )

        # Create a failed analysis result
        analysis = AnalysisResult(
            resume_id=sample_resume.id,
            job_requirement_id=sample_job.id,
            overall_score=0.0,
            recommendation=RecommendationLevel.PENDING,
            analysis_status=AnalysisStatus.FAILED,
            analyzed_at=None,
        )
        db_session.add(analysis)
        await db_session.commit()
        await db_session.refresh(analysis)

        resp = await async_client.post(
            f"/api/v1/analysis/{analysis.id}/retry",
            headers=auth_headers,
        )
        assert resp.status_code == 202
        body = resp.json()
        assert body["analysis_status"] == "pending"
        await db_session.refresh(analysis)
        assert float(analysis.overall_score) == 0.0
        assert analysis.recommendation == RecommendationLevel.PENDING
        assert analysis.recommendation_reason is None
        assert analysis.analysis_status == AnalysisStatus.PENDING
        mock_dispatch.assert_called_once()


class TestAnalysisIsolation:
    """Cross-company isolation for analysis results."""

    async def test_analysis_isolation_across_companies(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        second_company_headers: dict,
        sample_analysis: AnalysisResult,
    ):
        # Company A can see the analysis
        resp_a = await async_client.get(
            f"/api/v1/analysis/{sample_analysis.id}",
            headers=auth_headers,
        )
        assert resp_a.status_code == 200

        # Company B cannot see it
        resp_b = await async_client.get(
            f"/api/v1/analysis/{sample_analysis.id}",
            headers=second_company_headers,
        )
        assert resp_b.status_code == 404
