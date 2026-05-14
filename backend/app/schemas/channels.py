from datetime import datetime
from typing import Literal
import uuid

from pydantic import BaseModel, Field, field_validator


ChannelPlatform = Literal["boss_zhipin", "liepin", "lagou", "email", "other"]
ChannelContentFormat = Literal["text", "html"]


class ChannelCandidateImportItem(BaseModel):
    content: str = Field(..., min_length=20, description="已授权获取的候选人简历文本或页面正文")
    content_format: ChannelContentFormat = "text"
    candidate_name: str | None = Field(None, max_length=100)
    source_url: str | None = Field(None, max_length=1000)
    external_candidate_id: str | None = Field(None, max_length=255)


class ChannelCandidateImportRequest(BaseModel):
    job_requirement_id: uuid.UUID
    source_platform: ChannelPlatform = "other"
    consent_confirmed: bool = Field(
        ...,
        description="确认候选人信息来自平台授权、HR 合法导出、邮件投递或候选人主动提供",
    )
    candidates: list[ChannelCandidateImportItem] = Field(..., min_length=1, max_length=500)

    @field_validator("consent_confirmed")
    @classmethod
    def require_consent_confirmation(cls, value: bool) -> bool:
        if not value:
            raise ValueError("必须确认候选人数据来源已获得授权")
        return value


class ChannelImportResult(BaseModel):
    id: uuid.UUID
    resume_id: uuid.UUID
    candidate_name: str | None = None
    source_platform: str
    parse_status: str
    analysis_status: str


class ChannelImportFailed(BaseModel):
    candidate_name: str | None = None
    source_url: str | None = None
    error: str


class ChannelCandidateImportResponse(BaseModel):
    job_requirement_id: uuid.UUID
    imported: list[ChannelImportResult]
    failed: list[ChannelImportFailed]
    total_imported: int
    total_failed: int
    imported_at: datetime
