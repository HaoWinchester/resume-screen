from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, Enum as SQLEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone
import enum
import uuid

from ..database import Base


class CandidateWorkflowStatus(str, enum.Enum):
    NEW = "new"
    PRIORITY = "priority"
    CONTACTED = "contacted"
    INTERVIEW_SCHEDULED = "interview_scheduled"
    REJECTED = "rejected"
    HIRED = "hired"


class CandidateWorkflowAction(str, enum.Enum):
    MARK_PRIORITY = "mark_priority"
    MARK_CONTACTED = "mark_contacted"
    SCHEDULE_INTERVIEW = "schedule_interview"
    ADD_NOTE = "add_note"


class CandidateWorkflow(Base):
    __tablename__ = "candidate_workflows"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("analysis_results.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[CandidateWorkflowStatus] = mapped_column(
        SQLEnum(CandidateWorkflowStatus),
        default=CandidateWorkflowStatus.NEW,
        nullable=False,
        index=True,
    )
    is_priority: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    contact_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_contacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    interview_scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    interview_mode: Mapped[str | None] = mapped_column(String(50), nullable=True)
    interview_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    next_step: Mapped[str | None] = mapped_column(String(255), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    events = relationship("CandidateWorkflowEvent", back_populates="workflow", cascade="all, delete-orphan")


class CandidateWorkflowEvent(Base):
    __tablename__ = "candidate_workflow_events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    workflow_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_workflows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action: Mapped[CandidateWorkflowAction] = mapped_column(SQLEnum(CandidateWorkflowAction), nullable=False, index=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    workflow = relationship("CandidateWorkflow", back_populates="events")
