from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone
import uuid
import enum

from ..database import Base


class ResumeFileType(str, enum.Enum):
    PDF = "pdf"
    DOC = "doc"
    DOCX = "docx"
    JPG = "jpg"
    PNG = "png"


class ParseStatus(str, enum.Enum):
    PENDING = "pending"
    PARSING = "parsing"
    SUCCESS = "success"
    FAILED = "failed"


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    job_requirement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("job_requirements.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_type: Mapped[ResumeFileType] = mapped_column(
        SQLEnum(ResumeFileType),
        nullable=False
    )
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    parse_status: Mapped[ParseStatus] = mapped_column(
        SQLEnum(ParseStatus),
        default=ParseStatus.PENDING,
        nullable=False,
        index=True
    )
    parse_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    parsed_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    candidate_name: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    candidate_email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    candidate_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        index=True
    )

    # Relationships
    job_requirement = relationship("JobRequirement", back_populates="resumes")
    uploaded_by_user = relationship("User", back_populates="uploaded_resumes")
    analysis_result = relationship(
        "AnalysisResult",
        back_populates="resume",
        uselist=False,
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Resume(id={self.id}, file_name={self.file_name}, parse_status={self.parse_status})>"
