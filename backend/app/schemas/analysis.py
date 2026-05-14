from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class DimensionScoreItem(BaseModel):
    dimension: str
    score: float
    weight: str
    match_details: Optional[dict] = None


class AnalysisListItem(BaseModel):
    id: uuid.UUID
    resume_id: uuid.UUID
    candidate_name: Optional[str]
    candidate_email: Optional[str] = None
    overall_score: float
    recommendation: str
    recommendation_reason: Optional[str]
    dimension_scores: list[DimensionScoreItem]
    analyzed_at: Optional[datetime]


class MatchDetails(BaseModel):
    matched_skills: list[str]
    missing_skills: list[str]
    bonus_skills_matched: list[str]


class DimensionScoreDetail(BaseModel):
    dimension: str
    score: float
    weight: str
    analysis_text: str
    match_details: Optional[dict]


class AnalysisDetail(BaseModel):
    id: uuid.UUID
    resume_id: uuid.UUID
    job_requirement_id: uuid.UUID
    overall_score: float
    recommendation: str
    recommendation_reason: Optional[str]
    strengths: list[str]
    weaknesses: list[str]
    dimension_scores: list[DimensionScoreDetail]
    resume: dict
    job_requirement: dict
    analyzed_at: Optional[datetime]


class AnalysisStatistics(BaseModel):
    total_resumes: int
    analyzed: int
    pending: int
    failed: int
    strongly_recommended: int
    recommended: int
    average_score: float


class ResumeProgressDay(BaseModel):
    date: str
    label: str
    uploaded: int
    parsed: int
    failed: int
    processing: int


class ResumeProgressResponse(BaseModel):
    days: list[ResumeProgressDay]
    total_uploaded: int
    total_parsed: int
    total_failed: int
    total_processing: int


class RecentActivityItem(BaseModel):
    id: str
    type: str
    title: str
    description: str
    occurred_at: datetime
    icon: str
    tone: str


class RecentActivityResponse(BaseModel):
    items: list[RecentActivityItem]


class AnalysisListResponse(BaseModel):
    items: list[AnalysisListItem]
    total: int
    page: int
    per_page: int
    statistics: AnalysisStatistics


class ComparisonCandidate(BaseModel):
    analysis_id: uuid.UUID
    candidate_name: Optional[str]
    overall_score: float
    dimension_scores: list[DimensionScoreItem]
    key_info: dict


class ComparisonResponse(BaseModel):
    candidates: list[ComparisonCandidate]
