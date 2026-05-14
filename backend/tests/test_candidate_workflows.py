from datetime import datetime, timedelta, timezone

import pytest


pytestmark = pytest.mark.asyncio


async def test_candidate_workflow_priority_contact_interview(async_client, auth_headers, sample_analysis):
    priority_response = await async_client.post(
        f"/api/v1/candidate-workflows/{sample_analysis.id}/priority",
        headers=auth_headers,
        json={"note": "HR 手动加入优先沟通"},
    )

    assert priority_response.status_code == 200
    priority_payload = priority_response.json()
    assert priority_payload["status"] == "priority"
    assert priority_payload["is_priority"] is True
    assert priority_payload["events"][0]["action"] == "mark_priority"

    priority_pipeline_response = await async_client.get("/api/v1/hr/pipeline", headers=auth_headers)
    assert priority_pipeline_response.status_code == 200
    priority_summary = {item["label"]: item["value"] for item in priority_pipeline_response.json()["summary"]}
    assert priority_summary["优先沟通"] == 1

    contact_response = await async_client.post(
        f"/api/v1/candidate-workflows/{sample_analysis.id}/contact",
        headers=auth_headers,
        json={"note": "已电话沟通，候选人有兴趣"},
    )

    assert contact_response.status_code == 200
    contact_payload = contact_response.json()
    assert contact_payload["status"] == "contacted"
    assert contact_payload["contact_count"] == 1
    assert contact_payload["last_contacted_at"]

    contacted_pipeline_response = await async_client.get("/api/v1/hr/pipeline", headers=auth_headers)
    assert contacted_pipeline_response.status_code == 200
    contacted_summary = {item["label"]: item["value"] for item in contacted_pipeline_response.json()["summary"]}
    assert contacted_summary["优先沟通"] == 0
    assert contacted_summary["已沟通"] == 1

    communications_response = await async_client.get(
        f"/api/v1/hr/communications?analysis_id={sample_analysis.id}",
        headers=auth_headers,
    )
    assert communications_response.status_code == 200
    communications = communications_response.json()["items"]
    assert communications[0]["candidate_name"] == "张三"
    assert communications[0]["channel"] == "phone"
    assert "候选人有兴趣" in communications[0]["content"]

    interview_at = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    interview_response = await async_client.post(
        f"/api/v1/candidate-workflows/{sample_analysis.id}/interview",
        headers=auth_headers,
        json={
            "scheduled_at": interview_at,
            "mode": "online",
            "location": "腾讯会议",
            "note": "一面，重点看项目真实性",
        },
    )

    assert interview_response.status_code == 200
    interview_payload = interview_response.json()
    assert interview_payload["status"] == "interview_scheduled"
    assert interview_payload["candidate_email"] == "zhangsan@example.com"
    assert interview_payload["email_delivery_message"]
    assert interview_payload["interview_location"] == "腾讯会议"
    assert interview_payload["events"][0]["action"] == "schedule_interview"

    interview_pipeline_response = await async_client.get("/api/v1/hr/pipeline", headers=auth_headers)
    assert interview_pipeline_response.status_code == 200
    interview_summary = {item["label"]: item["value"] for item in interview_pipeline_response.json()["summary"]}
    assert interview_summary["已沟通"] == 0
    assert interview_summary["已约面试"] == 1

    list_response = await async_client.get(
        "/api/v1/candidate-workflows?status=interview_scheduled",
        headers=auth_headers,
    )
    assert list_response.status_code == 200
    assert list_response.json()["items"][0]["candidate_name"] == "张三"

    calendar_response = await async_client.get(
        "/api/v1/hr/calendar",
        headers=auth_headers,
    )
    assert calendar_response.status_code == 200
    calendar_items = calendar_response.json()["items"]
    assert len(calendar_items) == 1
    assert calendar_items[0]["candidate_name"] == "张三"
    assert calendar_items[0]["job_title"] == "Senior Python Developer"
    assert calendar_items[0]["location"] == "腾讯会议"
    assert "zhangsan@example.com" in calendar_items[0]["attendees"]

    reminders_response = await async_client.get("/api/v1/hr/reminders", headers=auth_headers)
    assert reminders_response.status_code == 200
    reminders = reminders_response.json()["items"]
    assert [item["reminder_type"] for item in reminders] == ["interview_reminder_3h", "interview_reminder_1h"]
    assert all(item["status"] == "pending" for item in reminders)
    assert reminders[0]["candidate_name"] == "张三"
    assert reminders[0]["job_title"] == "Senior Python Developer"

    communications_after_interview_response = await async_client.get(
        f"/api/v1/hr/communications?analysis_id={sample_analysis.id}",
        headers=auth_headers,
    )
    assert communications_after_interview_response.status_code == 200
    interview_communications = communications_after_interview_response.json()["items"]
    assert interview_communications[0]["channel"] == "email"
    assert interview_communications[0]["subject"] == "Senior Python Developer 面试邀约"
    assert "邮件" in interview_communications[0]["content"]


async def test_due_interview_reminder_dispatch_sends_email_and_records_communication(async_client, auth_headers, sample_analysis):
    interview_at = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    interview_response = await async_client.post(
        f"/api/v1/candidate-workflows/{sample_analysis.id}/interview",
        headers=auth_headers,
        json={
            "scheduled_at": interview_at,
            "mode": "online",
            "location": "腾讯会议",
            "note": "一面，提前提醒候选人",
        },
    )
    assert interview_response.status_code == 200

    dispatch_response = await async_client.post("/api/v1/hr/reminders/dispatch-due", headers=auth_headers)
    assert dispatch_response.status_code == 200
    dispatch_payload = dispatch_response.json()
    assert dispatch_payload["total"] == 1
    assert dispatch_payload["sent"] == 1
    assert dispatch_payload["failed"] == 0

    reminders_response = await async_client.get("/api/v1/hr/reminders", headers=auth_headers)
    assert reminders_response.status_code == 200
    reminders_by_type = {item["reminder_type"]: item for item in reminders_response.json()["items"]}
    assert reminders_by_type["interview_reminder_3h"]["status"] == "done"
    assert reminders_by_type["interview_reminder_1h"]["status"] == "pending"

    communications_response = await async_client.get(
        f"/api/v1/hr/communications?analysis_id={sample_analysis.id}",
        headers=auth_headers,
    )
    assert communications_response.status_code == 200
    communications = communications_response.json()["items"]
    assert communications[0]["channel"] == "email"
    assert "面试前3小时提醒" in communications[0]["subject"]
    assert "发送结果" in communications[0]["content"]


async def test_priority_workflow_is_visible_in_shortlist_queries(async_client, auth_headers, sample_analysis, sample_job):
    priority_response = await async_client.post(
        f"/api/v1/candidate-workflows/{sample_analysis.id}/priority",
        headers=auth_headers,
        json={"note": "HR 从候选人结果加入优先沟通"},
    )
    assert priority_response.status_code == 200

    all_response = await async_client.get("/api/v1/candidate-workflows", headers=auth_headers)
    assert all_response.status_code == 200
    all_items = all_response.json()["items"]
    assert any(item["analysis_id"] == str(sample_analysis.id) and item["is_priority"] for item in all_items)

    job_response = await async_client.get(
        f"/api/v1/candidate-workflows?job_requirement_id={sample_job.id}",
        headers=auth_headers,
    )
    assert job_response.status_code == 200
    job_items = job_response.json()["items"]
    assert job_items[0]["analysis_id"] == str(sample_analysis.id)
    assert job_items[0]["candidate_name"] == "张三"
    assert job_items[0]["job_title"] == "Senior Python Developer"

    status_response = await async_client.get("/api/v1/candidate-workflows?status=priority", headers=auth_headers)
    assert status_response.status_code == 200
    assert status_response.json()["items"][0]["analysis_id"] == str(sample_analysis.id)


async def test_schedule_interview_requires_email_and_accepts_manual_email(
    async_client,
    auth_headers,
    db_session,
    sample_analysis,
    sample_resume,
):
    sample_resume.candidate_email = None
    sample_resume.parsed_data = {**(sample_resume.parsed_data or {}), "email": None}
    await db_session.commit()

    interview_at = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    missing_email_response = await async_client.post(
        f"/api/v1/candidate-workflows/{sample_analysis.id}/interview",
        headers=auth_headers,
        json={
            "scheduled_at": interview_at,
            "mode": "online",
            "location": "腾讯会议",
        },
    )

    assert missing_email_response.status_code == 400
    assert "没有邮箱" in missing_email_response.json()["error"]["message"]

    response = await async_client.post(
        f"/api/v1/candidate-workflows/{sample_analysis.id}/interview",
        headers=auth_headers,
        json={
            "scheduled_at": interview_at,
            "mode": "online",
            "location": "腾讯会议",
            "candidate_email": "candidate@example.com",
        },
    )

    assert response.status_code == 200
    assert response.json()["candidate_email"] == "candidate@example.com"


async def test_mark_contacted_does_not_move_scheduled_interview_backward(async_client, auth_headers, sample_analysis):
    interview_at = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    interview_response = await async_client.post(
        f"/api/v1/candidate-workflows/{sample_analysis.id}/interview",
        headers=auth_headers,
        json={
            "scheduled_at": interview_at,
            "mode": "online",
            "location": "腾讯会议",
            "note": "一面已安排",
        },
    )
    assert interview_response.status_code == 200
    assert interview_response.json()["status"] == "interview_scheduled"

    contact_response = await async_client.post(
        f"/api/v1/candidate-workflows/{sample_analysis.id}/contact",
        headers=auth_headers,
        json={"note": "面试前电话确认候选人会准时参加"},
    )

    assert contact_response.status_code == 200
    payload = contact_response.json()
    assert payload["status"] == "interview_scheduled"
    assert payload["contact_count"] == 1
    assert payload["next_step"] == "等待候选人参加面试"


async def test_schedule_interview_requires_company_contact_info(
    async_client,
    auth_headers,
    db_session,
    sample_analysis,
    test_company,
):
    test_company.contact_name = None
    test_company.contact_phone = None
    await db_session.commit()

    interview_at = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    response = await async_client.post(
        f"/api/v1/candidate-workflows/{sample_analysis.id}/interview",
        headers=auth_headers,
        json={
            "scheduled_at": interview_at,
            "mode": "online",
            "location": "腾讯会议",
        },
    )

    assert response.status_code == 400
    assert "联系人和联系电话" in response.json()["error"]["message"]


async def test_candidate_workflows_are_company_scoped(async_client, second_company_headers, sample_analysis):
    response = await async_client.post(
        f"/api/v1/candidate-workflows/{sample_analysis.id}/priority",
        headers=second_company_headers,
        json={"note": "跨公司不应可见"},
    )

    assert response.status_code == 404
