from datetime import datetime
import uuid

from pydantic import BaseModel, EmailStr, Field


class CandidateWorkflowEventItem(BaseModel):
    id: uuid.UUID
    action: str
    note: str | None = None
    event_metadata: dict | None = None
    scheduled_at: datetime | None = None
    created_at: datetime


class CandidateWorkflowItem(BaseModel):
    id: uuid.UUID
    analysis_id: uuid.UUID
    status: str
    candidate_name: str | None = None
    candidate_email: str | None = None
    job_title: str | None = None
    score: float | None = None
    email_sent: bool | None = None
    email_delivery_message: str | None = None
    is_priority: bool
    contact_count: int
    last_contacted_at: datetime | None = None
    interview_scheduled_at: datetime | None = None
    interview_mode: str | None = None
    interview_location: str | None = None
    next_step: str | None = None
    note: str | None = None
    updated_at: datetime
    events: list[CandidateWorkflowEventItem] = []


class CandidateWorkflowListResponse(BaseModel):
    items: list[CandidateWorkflowItem]


class WorkflowNoteRequest(BaseModel):
    note: str | None = Field(default=None, max_length=2000)


class MarkContactedRequest(BaseModel):
    note: str | None = Field(default=None, max_length=2000)
    contacted_at: datetime | None = None


class ScheduleInterviewRequest(BaseModel):
    scheduled_at: datetime
    mode: str | None = Field(default="online", max_length=50)
    location: str | None = Field(default=None, max_length=255)
    note: str | None = Field(default=None, max_length=2000)
    candidate_email: EmailStr | None = None
