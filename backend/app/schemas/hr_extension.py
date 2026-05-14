from datetime import datetime
import uuid

from pydantic import BaseModel, Field, model_validator


class CandidateContext(BaseModel):
    analysis_id: uuid.UUID
    resume_id: uuid.UUID
    candidate_name: str | None = None
    candidate_email: str | None = None
    job_id: uuid.UUID
    job_title: str
    score: float
    recommendation: str


class InterviewFeedbackCreate(BaseModel):
    analysis_id: uuid.UUID
    interviewer_user_id: uuid.UUID | None = None
    interview_round: str = Field(min_length=1, max_length=80)
    rating: int = Field(ge=1, le=5)
    recommendation: str = Field(min_length=1, max_length=40)
    strengths: list[str] = []
    concerns: list[str] = []
    summary: str | None = Field(default=None, max_length=4000)
    next_step: str | None = Field(default=None, max_length=255)


class InterviewFeedbackItem(InterviewFeedbackCreate):
    id: uuid.UUID
    created_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime


class InterviewFeedbackListResponse(BaseModel):
    items: list[InterviewFeedbackItem]
    total: int


class CommunicationCreate(BaseModel):
    analysis_id: uuid.UUID
    channel: str = Field(min_length=1, max_length=40)
    direction: str = Field(default="outbound", max_length=20)
    subject: str | None = Field(default=None, max_length=255)
    content: str = Field(min_length=1, max_length=8000)
    occurred_at: datetime | None = None
    contact_person: str | None = Field(default=None, max_length=100)


class CommunicationItem(CommunicationCreate):
    id: uuid.UUID
    occurred_at: datetime
    created_by: uuid.UUID | None = None
    created_at: datetime


class CommunicationListResponse(BaseModel):
    items: list[CommunicationItem]
    total: int


class CandidateTagCreate(BaseModel):
    analysis_id: uuid.UUID
    tag: str = Field(min_length=1, max_length=60)
    color: str | None = Field(default=None, max_length=30)
    note: str | None = Field(default=None, max_length=1000)


class CandidateTagItem(CandidateTagCreate):
    id: uuid.UUID
    created_by: uuid.UUID | None = None
    created_at: datetime


class CandidateTagListResponse(BaseModel):
    items: list[CandidateTagItem]
    total: int


class ReminderCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    due_at: datetime
    reminder_type: str = Field(default="follow_up", max_length=50)
    analysis_id: uuid.UUID | None = None
    job_requirement_id: uuid.UUID | None = None
    note: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def require_link(self):
        if self.analysis_id is None and self.job_requirement_id is None:
            raise ValueError("analysis_id 或 job_requirement_id 至少需要提供一个")
        return self


class ReminderItem(ReminderCreate):
    id: uuid.UUID
    status: str
    completed_by: uuid.UUID | None = None
    completed_at: datetime | None = None
    created_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
    candidate: CandidateContext | None = None


class ReminderListResponse(BaseModel):
    items: list[ReminderItem]
    total: int


class EmailTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    template_type: str = Field(min_length=1, max_length=50)
    subject: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1, max_length=12000)
    variables: list[str] = []
    is_active: bool = True


class EmailTemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    template_type: str | None = Field(default=None, min_length=1, max_length=50)
    subject: str | None = Field(default=None, min_length=1, max_length=255)
    body: str | None = Field(default=None, min_length=1, max_length=12000)
    variables: list[str] | None = None
    is_active: bool | None = None


class EmailTemplateItem(EmailTemplateCreate):
    id: uuid.UUID
    created_by: uuid.UUID | None = None
    updated_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime


class EmailTemplateListResponse(BaseModel):
    items: list[EmailTemplateItem]
    total: int


class CalendarEventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    start_at: datetime
    end_at: datetime | None = None
    analysis_id: uuid.UUID | None = None
    reminder_id: uuid.UUID | None = None
    location: str | None = Field(default=None, max_length=255)
    provider: str | None = Field(default=None, max_length=50)
    external_event_id: str | None = Field(default=None, max_length=255)
    attendees: list[str] = []
    note: str | None = Field(default=None, max_length=2000)


class CalendarEventItem(CalendarEventCreate):
    id: uuid.UUID
    created_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
    candidate: CandidateContext | None = None


class CalendarEventListResponse(BaseModel):
    items: list[CalendarEventItem]
    total: int


class FunnelStage(BaseModel):
    key: str
    label: str
    count: int
    conversion: float


class RecruitmentFunnelResponse(BaseModel):
    job_id: uuid.UUID | None = None
    generated_at: datetime
    stages: list[FunnelStage]


class JDOptimizationSuggestion(BaseModel):
    category: str
    signal: str
    suggestion: str
    priority: str


class JDOptimizationResponse(BaseModel):
    job_id: uuid.UUID
    job_title: str
    total_resumes: int
    analyzed: int
    average_score: float
    suggestions: list[JDOptimizationSuggestion]
    generated_at: datetime


class CandidateComparisonItem(BaseModel):
    candidate: CandidateContext
    skills: list[str]
    risks: list[str]
    tags: list[str]
    communication_count: int
    feedback_count: int
    latest_feedback: InterviewFeedbackItem | None = None
    pending_reminders: int


class CandidateComparisonResponse(BaseModel):
    items: list[CandidateComparisonItem]
    generated_at: datetime


class AuditLogItem(BaseModel):
    id: uuid.UUID
    actor_user_id: uuid.UUID | None = None
    action: str
    entity_type: str
    entity_id: str | None = None
    summary: str
    audit_metadata: dict | None = None
    created_at: datetime


class AuditLogListResponse(BaseModel):
    items: list[AuditLogItem]
    total: int
