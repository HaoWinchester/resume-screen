from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

from .job_requirement import CriteriaSchema


class JobTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    content: CriteriaSchema


class JobTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[CriteriaSchema] = None


class JobTemplateResponse(BaseModel):
    id: uuid.UUID
    name: str
    content: CriteriaSchema
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
