from pydantic import BaseModel
from typing import TypeVar, Generic, Optional


class ErrorResponseDetail(BaseModel):
    field: Optional[str] = None
    message: str


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: list[ErrorResponseDetail] = []


T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    per_page: int
