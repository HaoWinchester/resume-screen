"""Tests for comparison and export: /api/v1/analysis/compare and /api/v1/analysis/export."""

import uuid

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


async def _create_analysis_with_resume(
    db_session,
    job: JobRequirement,
    user_id,
    candidate_name: str,
    score: float,
    status=AnalysisStatus.COMPLETED,
):
    """Helper: create a resume + analysis + dimension scores."""
    resume = Resume(
        job_requirement_id=job.id,
        file_name=f"{candidate_name}_resume.pdf",
        file_path=f"/tmp/{candidate_name}.pdf",
        file_type=ResumeFileType.PDF,
        file_size=500,
        parse_status=ParseStatus.SUCCESS,
        candidate_name=candidate_name,
        candidate_email=f"{candidate_name}@example.com",
        candidate_phone="13800000000",
        parsed_data={
            "name": candidate_name,
            "email": f"{candidate_name}@example.com",
            "skills": ["Python", "FastAPI"],
            "education": [{"school": "Test U", "degree": "本科", "major": "CS"}],
            "work_experience": [],
            "projects": [],
        },
        uploaded_by=user_id,
    )
    db_session.add(resume)
    await db_session.flush()

    analysis = AnalysisResult(
        resume_id=resume.id,
        job_requirement_id=job.id,
        overall_score=score,
        recommendation=RecommendationLevel.STRONGLY_RECOMMENDED,
        recommendation_reason="Test reason",
        strengths=["Good skills"],
        weaknesses=["Lacks experience"],
        analysis_status=status,
    )
    db_session.add(analysis)
    await db_session.flush()

    dims = [
        DimensionScore(
            analysis_id=analysis.id,
            dimension=Dimension.SKILL_MATCH,
            score=score,
            weight="high",
            analysis_text="Test",
            match_details=None,
        ),
        DimensionScore(
            analysis_id=analysis.id,
            dimension=Dimension.EXPERIENCE_MATCH,
            score=score - 5,
            weight="medium",
            analysis_text="Test",
            match_details=None,
        ),
    ]
    for d in dims:
        db_session.add(d)

    await db_session.commit()
    await db_session.refresh(analysis)
    return analysis


# ---------------------------------------------------------------------------
# Comparison
# ---------------------------------------------------------------------------

class TestCompareCandidates:
    """GET /api/v1/analysis/compare"""

    async def test_compare_2_candidates(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        db_session,
        sample_job: JobRequirement,
        test_user,
    ):
        a1 = await _create_analysis_with_resume(
            db_session, sample_job, test_user.id, "Alice", 85.0
        )
        a2 = await _create_analysis_with_resume(
            db_session, sample_job, test_user.id, "Bob", 78.0
        )

        resp = await async_client.get(
            f"/api/v1/analysis/compare?analysis_ids={a1.id},{a2.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 200, f"compare: {resp.status_code} {resp.text}"
        body = resp.json()
        assert "candidates" in body
        assert len(body["candidates"]) == 2
        body = resp.json()
        assert "candidates" in body
        assert len(body["candidates"]) == 2

    async def test_compare_1_candidate_fails(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        db_session,
        sample_job: JobRequirement,
        test_user,
    ):
        a1 = await _create_analysis_with_resume(
            db_session, sample_job, test_user.id, "Solo", 90.0
        )

        resp = await async_client.get(
            f"/api/v1/analysis/compare?analysis_ids={a1.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 422

    async def test_compare_4_candidates_fails(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        db_session,
        sample_job: JobRequirement,
        test_user,
    ):
        analyses = []
        for i in range(4):
            a = await _create_analysis_with_resume(
                db_session, sample_job, test_user.id, f"Candidate{i}", 70.0 + i
            )
            analyses.append(a)

        ids_str = ",".join(str(a.id) for a in analyses)
        resp = await async_client.get(
            f"/api/v1/analysis/compare?analysis_ids={ids_str}",
            headers=auth_headers,
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

class TestExportAnalysis:
    """GET /api/v1/analysis/export"""

    async def test_export_xlsx(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        db_session,
        sample_job: JobRequirement,
        test_user,
    ):
        await _create_analysis_with_resume(
            db_session, sample_job, test_user.id, "ExportUser", 80.0
        )

        resp = await async_client.get(
            f"/api/v1/analysis/export?job_requirement_id={sample_job.id}&format=xlsx",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/octet-stream"
        assert "attachment" in resp.headers.get("content-disposition", "")
        assert len(resp.content) > 0

    async def test_export_csv(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        db_session,
        sample_job: JobRequirement,
        test_user,
    ):
        await _create_analysis_with_resume(
            db_session, sample_job, test_user.id, "CSVUser", 75.0
        )

        resp = await async_client.get(
            f"/api/v1/analysis/export?job_requirement_id={sample_job.id}&format=csv",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert "text/csv" in resp.headers.get("content-type", "")
        content_str = resp.content.decode("utf-8-sig")
        # Should have header row + at least one data row
        lines = content_str.strip().split("\n")
        assert len(lines) >= 2

    async def test_export_empty_results(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        sample_job: JobRequirement,
    ):
        # No completed analyses for this job
        resp = await async_client.get(
            f"/api/v1/analysis/export?job_requirement_id={sample_job.id}&format=csv",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        content_str = resp.content.decode("utf-8-sig")
        lines = content_str.strip().split("\n")
        # Only header row, no data rows
        assert len(lines) == 1

    async def test_export_nonexistent_job(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
    ):
        resp = await async_client.get(
            f"/api/v1/analysis/export?job_requirement_id={uuid.uuid4()}&format=xlsx",
            headers=auth_headers,
        )
        assert resp.status_code == 404
