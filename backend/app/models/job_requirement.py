from sqlalchemy import String, Text, DateTime, ForeignKey, Enum as SQLEnum, JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone
import uuid
import enum

from ..database import Base


class JobRequirementStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"


class JobRequirement(Base):
    __tablename__ = "job_requirements"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("job_templates.id", ondelete="SET NULL"),
        nullable=True
    )
    status: Mapped[JobRequirementStatus] = mapped_column(
        SQLEnum(JobRequirementStatus),
        default=JobRequirementStatus.DRAFT,
        nullable=False,
        index=True
    )
    criteria: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    company = relationship("Company", back_populates="job_requirements")
    created_by_user = relationship("User", back_populates="job_requirements")
    template = relationship("JobTemplate", back_populates="job_requirements")
    resumes = relationship("Resume", back_populates="job_requirement", cascade="all, delete-orphan")
    analysis_results = relationship("AnalysisResult", back_populates="job_requirement", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<JobRequirement(id={self.id}, title={self.title}, status={self.status})>"
