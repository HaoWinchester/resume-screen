from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class ParseStatus:
    PENDING = "pending"
    PARSING = "parsing"
    SUCCESS = "success"
    FAILED = "failed"


class ResumeUploadResult(BaseModel):
    id: uuid.UUID
    file_name: str
    parse_status: str


class ResumeUploadFailed(BaseModel):
    file_name: str
    error: str


class ResumeUploadResponse(BaseModel):
    job_requirement_id: uuid.UUID
    uploaded: list[ResumeUploadResult]
    failed: list[ResumeUploadFailed]
    total_uploaded: int
    total_failed: int


class ResumeListItem(BaseModel):
    id: uuid.UUID
    file_name: str
    parse_status: str
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    candidate_phone: Optional[str] = None
    created_at: datetime


class ResumeDetail(BaseModel):
    id: uuid.UUID
    file_name: str
    file_type: str
    file_size: int
    parse_status: str
    parse_error: Optional[str] = None
    parsed_data: Optional[dict] = None
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    candidate_phone: Optional[str] = None
    created_at: datetime
    file_url: str


class ResumeListResponse(BaseModel):
    items: list[ResumeListItem]
    total: int
    page: int
    per_page: int
