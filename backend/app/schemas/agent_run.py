from __future__ import annotations

from datetime import datetime
import uuid

from pydantic import BaseModel, Field


class AgentRunCreate(BaseModel):
    task_type: str = Field(default="candidate_next_step", max_length=80)
    target_type: str = Field(default="analysis", max_length=80)
    target_id: uuid.UUID
    task_prompt: str | None = Field(default=None, max_length=2000)
    context: dict | None = None
    run_async: bool = True


class AgentRunStepItem(BaseModel):
    id: uuid.UUID
    step_index: int
    agent_name: str
    status: str
    input_packet: dict | None = None
    output: dict | None = None
    summary: str | None = None
    error: str | None = None
    started_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class AgentRunItem(BaseModel):
    id: uuid.UUID
    task_type: str
    target_type: str
    target_id: uuid.UUID
    task_prompt: str | None = None
    status: str
    current_agent: str | None = None
    result: dict | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
    steps: list[AgentRunStepItem] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class AgentRunListResponse(BaseModel):
    items: list[AgentRunItem]
