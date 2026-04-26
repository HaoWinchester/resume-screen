from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
import uuid


class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., description="登录邮箱")
    password: str = Field(..., min_length=8, max_length=100, description="密码")
    name: str = Field(..., min_length=1, max_length=100, description="用户姓名")
    company_name: str = Field(..., min_length=1, max_length=200, description="公司名称")


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="登录邮箱")
    password: str = Field(..., description="密码")


class ResetPasswordRequest(BaseModel):
    email: EmailStr = Field(..., description="登录邮箱")


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    role: str
    company_id: uuid.UUID


class TokenResponse(BaseModel):
    user: UserResponse
    access_token: str
    token_type: str = "bearer"
