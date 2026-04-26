from sqlalchemy import String, Numeric, DateTime, ForeignKey, Enum as SQLEnum, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone
import uuid
import enum

from ..database import Base


class AnalysisStatus(str, enum.Enum):
    PENDING = "pending"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"


class RecommendationLevel(str, enum.Enum):
    STRONGLY_RECOMMENDED = "strongly_recommended"
    RECOMMENDED = "recommended"
    PENDING = "pending"


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    resume_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("resumes.id", ondelete="CASCADE"),
        nullable=False,
        unique=True
    )
    job_requirement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("job_requirements.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    overall_score: Mapped[float] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        index=True
    )
    recommendation: Mapped[RecommendationLevel] = mapped_column(
        SQLEnum(RecommendationLevel),
        default=RecommendationLevel.PENDING,
        nullable=False
    )
    recommendation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    strengths: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    weaknesses: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    analysis_status: Mapped[AnalysisStatus] = mapped_column(
        SQLEnum(AnalysisStatus),
        default=AnalysisStatus.PENDING,
        nullable=False
    )
    analyzed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    resume = relationship("Resume", back_populates="analysis_result")
    job_requirement = relationship("JobRequirement", back_populates="analysis_results")
    dimension_scores = relationship(
        "DimensionScore",
        back_populates="analysis_result",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<AnalysisResult(id={self.id}, overall_score={self.overall_score}, recommendation={self.recommendation})>"
