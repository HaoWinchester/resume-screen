import pytest
from sqlalchemy import select

from app.models import AgentRun, AgentRunStatus
from app.services.agent_runtime_service import AgentRuntimeService
from app.tasks.analyze_resume import _maybe_enqueue_agent_run


pytestmark = pytest.mark.asyncio


async def test_agent_run_executes_recruitment_team(
    async_client,
    auth_headers,
    sample_analysis,
    monkeypatch,
):
    monkeypatch.setattr(
        "app.services.agent_runtime_service.AIAnalyzer._resolve_provider_order",
        lambda self: ["local"],
    )

    response = await async_client.post(
        "/api/v1/agent-runs",
        headers=auth_headers,
        json={
            "task_type": "candidate_next_step",
            "target_type": "analysis",
            "target_id": str(sample_analysis.id),
            "run_async": False,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "completed"
    assert payload["target_id"] == str(sample_analysis.id)
    assert payload["result"]["recommended_next_step"] == "priority_contact"
    assert payload["result"]["safe_to_auto_apply"] is False
    assert len(payload["steps"]) == 5

    agent_names = [step["agent_name"] for step in payload["steps"]]
    assert agent_names == [
        "orchestrator-agent",
        "candidate-review-agent",
        "interview-agent",
        "communication-agent",
        "audit-agent",
    ]
    assert all(step["status"] == "completed" for step in payload["steps"])
    interview_step = next(step for step in payload["steps"] if step["agent_name"] == "interview-agent")
    assert "面试" in interview_step["summary"]
    assert "Agent step completed" not in {step["summary"] for step in payload["steps"]}
    assert "candidate_message_draft" in payload["result"]["agent_outputs"]["communication-agent"]

    list_response = await async_client.get(
        f"/api/v1/agent-runs?target_type=analysis&target_id={sample_analysis.id}",
        headers=auth_headers,
    )

    assert list_response.status_code == 200
    items = list_response.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == payload["id"]


async def test_agent_run_is_company_scoped(async_client, second_company_headers, sample_analysis):
    response = await async_client.post(
        "/api/v1/agent-runs",
        headers=second_company_headers,
        json={
            "task_type": "candidate_next_step",
            "target_type": "analysis",
            "target_id": str(sample_analysis.id),
            "run_async": False,
        },
    )

    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "BAD_REQUEST"
    assert "AGENT_RUN_INVALID" in body["error"]["message"]


async def test_analysis_completion_enqueues_one_agent_run(
    db_session,
    sample_analysis,
    sample_resume,
    sample_job,
    monkeypatch,
):
    dispatched: list[str] = []
    monkeypatch.setattr(
        "app.services.task_dispatcher.dispatch_agent_run",
        lambda run_id: dispatched.append(run_id) or "local",
    )

    first = await _maybe_enqueue_agent_run(db_session, sample_analysis, sample_resume, sample_job)
    second = await _maybe_enqueue_agent_run(db_session, sample_analysis, sample_resume, sample_job)

    assert first["agent_run_dispatched"] is True
    assert first["agent_run_dispatch_mode"] == "local"
    assert second["agent_run_dispatched"] is False
    assert second["agent_run_id"] == first["agent_run_id"]
    assert dispatched == [first["agent_run_id"]]

    result = await db_session.execute(select(AgentRun))
    runs = result.scalars().all()
    assert len(runs) == 1
    assert runs[0].status == AgentRunStatus.PENDING


async def test_ensure_run_for_analysis_reuses_fresh_run(db_session, sample_analysis, test_user):
    service = AgentRuntimeService(db_session)

    first, first_created = await service.ensure_run_for_analysis(
        company_id=test_user.company_id,
        analysis_id=sample_analysis.id,
        created_by=test_user.id,
        fresh_after=sample_analysis.analyzed_at,
    )
    second, second_created = await service.ensure_run_for_analysis(
        company_id=test_user.company_id,
        analysis_id=sample_analysis.id,
        created_by=test_user.id,
        fresh_after=sample_analysis.analyzed_at,
    )

    assert first_created is True
    assert second_created is False
    assert second.id == first.id
