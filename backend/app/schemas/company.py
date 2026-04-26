from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
import uuid


class CompanyResponse(BaseModel):
    id: uuid.UUID
    name: str
    industry: Optional[str]
    created_at: datetime


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
