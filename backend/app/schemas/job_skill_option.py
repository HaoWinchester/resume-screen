from datetime import datetime
import uuid

from pydantic import BaseModel, Field, field_validator


class JobSkillOptionCreate(BaseModel):
    job_type: str = Field(min_length=1, max_length=80)
    option_type: str = Field(pattern="^(required|bonus)$")
    value: str = Field(min_length=1, max_length=120)

    @field_validator("job_type", "value")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class JobSkillOptionResponse(BaseModel):
    id: uuid.UUID
    job_type: str
    option_type: str
    value: str
    created_at: datetime


class JobSkillOptionListResponse(BaseModel):
    items: list[JobSkillOptionResponse]
