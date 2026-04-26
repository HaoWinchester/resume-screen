from sqlalchemy import String, Numeric, Text, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid
import enum

from ..database import Base


class Dimension(str, enum.Enum):
    SKILL_MATCH = "skill_match"
    EXPERIENCE_MATCH = "experience_match"
    EDUCATION = "education"
    PROJECT_RELEVANCE = "project_relevance"
    OVERALL_QUALITY = "overall_quality"


class DimensionScore(Base):
    __tablename__ = "dimension_scores"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("analysis_results.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    dimension: Mapped[Dimension] = mapped_column(
        SQLEnum(Dimension),
        nullable=False
    )
    score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    weight: Mapped[str] = mapped_column(String(10), nullable=False)
    analysis_text: Mapped[str] = mapped_column(Text, nullable=False)
    match_details: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationships
    analysis_result = relationship("AnalysisResult", back_populates="dimension_scores")

    def __repr__(self) -> str:
        return f"<DimensionScore(id={self.id}, dimension={self.dimension}, score={self.score})>"
