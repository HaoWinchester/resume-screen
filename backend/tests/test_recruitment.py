import pytest


pytestmark = pytest.mark.asyncio


async def test_recruitment_overview_uses_company_data(async_client, auth_headers, sample_analysis):
    response = await async_client.get("/api/v1/recruitment/overview", headers=auth_headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["metrics"]
    metric_map = {item["label"]: item["value"] for item in payload["metrics"]}
    assert metric_map["候选人总量"] == 1
    assert metric_map["已完成分析"] == 1
    assert payload["funnel"][0]["key"] == "uploaded"
    assert payload["entries"]


async def test_talent_pool_and_candidate_report(async_client, auth_headers, sample_analysis):
    pool_response = await async_client.get("/api/v1/recruitment/talent-pool", headers=auth_headers)

    assert pool_response.status_code == 200
    pool_payload = pool_response.json()
    assert pool_payload["total"] == 1
    candidate = pool_payload["items"][0]
    assert candidate["candidateName"] == "张三"
    assert candidate["jobTitle"] == "Senior Python Developer"
    assert "Python" in candidate["skills"]

    report_response = await async_client.get(
        f"/api/v1/recruitment/candidate-report/{sample_analysis.id}",
        headers=auth_headers,
    )

    assert report_response.status_code == 200
    report = report_response.json()
    assert report["candidateName"] == "张三"
    assert report["recommendationReasons"]
    assert report["interviewQuestions"]
    assert report["outreachScripts"]
