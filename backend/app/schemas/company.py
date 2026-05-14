from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime
import uuid


class CompanyResponse(BaseModel):
    id: uuid.UUID
    name: str
    industry: Optional[str]
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    created_at: datetime


class CompanyUpdateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    industry: Optional[str] = Field(default=None, max_length=100)
    contact_name: Optional[str] = Field(default=None, max_length=100)
    contact_phone: Optional[str] = Field(default=None, max_length=50)
    contact_email: Optional[EmailStr] = None

    @field_validator("contact_phone")
    @classmethod
    def validate_contact_phone(cls, value: Optional[str]) -> Optional[str]:
        if not value:
            return value
        digit_count = sum(1 for char in value if char.isdigit())
        if digit_count < 6:
            raise ValueError("联系电话格式不正确")
        return value


class MemberItem(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime


class MemberListResponse(BaseModel):
    members: list[MemberItem]
    total: int


class InviteRequest(BaseModel):
    email: EmailStr
    name: str
    role: str


class UpdateRoleRequest(BaseModel):
    role: str
