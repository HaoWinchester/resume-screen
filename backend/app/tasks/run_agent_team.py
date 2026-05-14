from __future__ import annotations

import asyncio
import uuid

from app.services.agent_runtime_service import AgentRuntimeService
from app.tasks.task_db import task_session
from app.worker import celery_app


async def run_agent_team(agent_run_id: str, *, raise_exceptions: bool = False):
    try:
        async with task_session() as db:
            service = AgentRuntimeService(db)
            run = await service.execute_run(uuid.UUID(agent_run_id))
            return {"agent_run_id": str(run.id), "status": run.status.value}
    except Exception as exc:
        if raise_exceptions:
            raise
        return {"agent_run_id": agent_run_id, "status": "failed", "error": str(exc)}


@celery_app.task(bind=True, name="app.tasks.run_agent_team", max_retries=2)
def run_agent_team_task(self, agent_run_id: str):
    try:
        return asyncio.run(run_agent_team(agent_run_id, raise_exceptions=True))
    except Exception as exc:
        try:
            raise self.retry(exc=exc, countdown=30)
        except Exception:
            pass
        return {"agent_run_id": agent_run_id, "status": "failed", "error": str(exc)}
