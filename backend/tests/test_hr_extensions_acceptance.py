import pytest


pytestmark = pytest.mark.asyncio


async def test_hr_extensions_do_not_leak_candidate_data_across_companies(
    async_client,
    second_company_headers,
    sample_analysis,
):
    pool_response = await async_client.get(
        "/api/v1/recruitment/talent-pool",
        headers=second_company_headers,
    )

    assert pool_response.status_code == 200
    assert pool_response.json()["total"] == 0

    report_response = await async_client.get(
        f"/api/v1/recruitment/candidate-report/{sample_analysis.id}",
        headers=second_company_headers,
    )

    assert report_response.status_code == 404

    workflow_response = await async_client.get(
        f"/api/v1/candidate-workflows/{sample_analysis.id}",
        headers=second_company_headers,
    )

    assert workflow_response.status_code == 404


async def test_channel_import_blocks_unauthorized_or_inactive_job_sources(
    async_client,
    auth_headers,
    second_company_headers,
    sample_job,
    sample_draft_job,
):
    payload = {
        "job_requirement_id": str(sample_job.id),
        "source_platform": "boss_zhipin",
        "consent_confirmed": True,
        "candidates": [
            {
                "candidate_name": "授权候选人",
                "content": "授权候选人 Python FastAPI PostgreSQL Docker 5 年后端开发经验 candidate@example.com",
            }
        ],
    }

    cross_company_response = await async_client.post(
        "/api/v1/channels/candidates/import",
        headers=second_company_headers,
        json=payload,
    )

    assert cross_company_response.status_code == 404

    inactive_job_response = await async_client.post(
        "/api/v1/channels/candidates/import",
        headers=auth_headers,
        json={**payload, "job_requirement_id": str(sample_draft_job.id)},
    )

    assert inactive_job_response.status_code == 400
    assert "仅活跃状态" in inactive_job_response.json()["error"]["message"]


async def test_recruitment_overview_and_report_keep_customer_navigation_contract(
    async_client,
    auth_headers,
    sample_analysis,
):
    overview_response = await async_client.get(
        "/api/v1/recruitment/overview",
        headers=auth_headers,
    )

    assert overview_response.status_code == 200
    overview = overview_response.json()
    metric_labels = {item["label"] for item in overview["metrics"]}
    pipeline_keys = {item["key"] for item in overview["pipeline"]}
    entry_hrefs = {item["href"] for item in overview["entries"]}

    assert {"开放岗位", "候选人总量", "已完成分析", "优先沟通", "平均匹配分"} <= metric_labels
    assert {"to_analyze", "to_contact", "contacted", "interview_scheduled", "to_review"} <= pipeline_keys
    assert {"/dashboard/shortlist", "/dashboard/talent-pool"} <= entry_hrefs

    report_response = await async_client.get(
        f"/api/v1/recruitment/reports/{sample_analysis.id}",
        headers=auth_headers,
    )

    assert report_response.status_code == 200
    report = report_response.json()
    assert report["candidateName"] == "张三"
    assert report["candidateEmail"] == "zhangsan@example.com"
    assert report["recommendationReasons"]
    assert report["riskPoints"]
    assert report["interviewQuestions"]
    assert report["outreachScripts"]


async def test_company_contact_settings_gate_interview_notifications(
    async_client,
    auth_headers,
    db_session,
    sample_analysis,
    test_company,
):
    invalid_contact_response = await async_client.patch(
        "/api/v1/companies/me",
        headers=auth_headers,
        json={
            "name": "Test Company",
            "industry": "Technology",
            "contact_name": "HR",
            "contact_phone": "12",
        },
    )

    assert invalid_contact_response.status_code == 422

    valid_contact_response = await async_client.patch(
        "/api/v1/companies/me",
        headers=auth_headers,
        json={
            "name": "Test Company",
            "industry": "Technology",
            "contact_name": "  HR Talent  ",
            "contact_phone": "  13800000000  ",
            "contact_email": "hr@example.com",
        },
    )

    assert valid_contact_response.status_code == 200
    company_payload = valid_contact_response.json()
    assert company_payload["contact_name"] == "HR Talent"
    assert company_payload["contact_phone"] == "13800000000"
    assert company_payload["contact_email"] == "hr@example.com"

    test_company.contact_name = None
    test_company.contact_phone = None
    await db_session.commit()

    interview_response = await async_client.post(
        f"/api/v1/candidate-workflows/{sample_analysis.id}/interview",
        headers=auth_headers,
        json={
            "scheduled_at": "2026-05-01T10:00:00+08:00",
            "mode": "online",
            "location": "腾讯会议",
        },
    )

    assert interview_response.status_code == 400
    assert "联系人和联系电话" in interview_response.json()["error"]["message"]


async def test_hr_extension_frontend_routes_have_backend_contracts(
    async_client,
    auth_headers,
    sample_job,
):
    get_endpoints = [
        "/api/v1/hr/pipeline",
        "/api/v1/hr/communications",
        "/api/v1/hr/interview-feedback",
        "/api/v1/hr/email-templates",
        "/api/v1/hr/reminders",
        "/api/v1/hr/calendar",
        "/api/v1/hr/audit",
    ]

    for endpoint in get_endpoints:
        response = await async_client.get(endpoint, headers=auth_headers)
        assert response.status_code != 404, f"{endpoint} is used by the frontend but is not mounted"

    optimizer_response = await async_client.post(
        "/api/v1/hr/jd-optimizer",
        headers=auth_headers,
        json={"job_requirement_id": str(sample_job.id)},
    )
    assert optimizer_response.status_code != 404, "/api/v1/hr/jd-optimizer is used by the frontend but is not mounted"


async def test_hr_email_templates_include_editable_built_in_templates(
    async_client,
    auth_headers,
    test_company,
):
    response = await async_client.get("/api/v1/hr/email-templates", headers=auth_headers)

    assert response.status_code == 200
    payload = response.json()
    names = {item["name"] for item in payload["items"]}
    scenarios = {item["scenario"] for item in payload["items"]}

    default_names = {
        "面试邀约通知",
        "面试前提醒",
        "面试改期通知",
        "沟通跟进邮件",
        "候选人婉拒通知",
        "Offer 意向确认",
    }
    assert default_names <= names
    assert {
        "interview_invitation",
        "interview_reminder",
        "interview_reschedule",
        "follow_up",
        "rejection",
        "offer_intent",
    } <= scenarios
    assert all(item["is_active"] for item in payload["items"] if item["name"] in default_names)
    default_items = [item for item in payload["items"] if item["name"] in default_names]
    assert all(test_company.name in item["subject"] or test_company.name in item["body"] for item in default_items)
    assert not any("{{公司名称}}" in item["subject"] or "{{公司名称}}" in item["body"] for item in default_items)
    assert not any("company_name" in item["subject"] or "company_name" in item["body"] for item in default_items)
    assert not any("公司名称" in item["variables"] for item in default_items)
