from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid


class WeightConfig(BaseModel):
    skill_match: str = Field(..., pattern="^(high|medium|low)$")
    experience_match: str = Field(..., pattern="^(high|medium|low)$")
    education: str = Field(..., pattern="^(high|medium|low)$")
    project_relevance: str = Field(..., pattern="^(high|medium|low)$")
    overall_quality: str = Field(..., pattern="^(high|medium|low)$")


class CriteriaSchema(BaseModel):
    required_skills: list[str] = Field(default_factory=list)
    bonus_skills: list[str] = Field(default_factory=list)
    min_experience_years: Optional[int] = Field(None, ge=0, le=50)
    education: Optional[str] = Field(None, pattern="^(high_school|vocational|associate|bachelor|master|doctor)$")
    industry_preference: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    weights: WeightConfig
    other_requirements: Optional[str] = None


class JobRequirementCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    template_id: Optional[uuid.UUID] = None
    criteria: CriteriaSchema


class JobRequirementUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    criteria: Optional[CriteriaSchema] = None


class JobRequirementResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str]
    status: str
    criteria: CriteriaSchema
    created_by: uuid.UUID
    resume_count: Optional[int] = 0
    analyzed_count: Optional[int] = 0
    created_at: datetime
    updated_at: datetime


class JobRequirementActivateResponse(BaseModel):
    id: uuid.UUID
    status: str
