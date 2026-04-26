from fastapi import Request, HTTPException, status
from typing import Callable

from app.config import get_settings

settings = get_settings()


async def auth_middleware(request: Request, call_next: Callable):
    """Authentication middleware to extract JWT token from Authorization header."""
    # Skip auth for health check and public endpoints
    if request.url.path in ["/health", "/docs", "/redoc", "/openapi.json"]:
        return await call_next(request)

    # Skip auth for auth endpoints
    if request.url.path.startswith("/api/v1/auth"):
        return await call_next(request)

    # For other endpoints, the auth is handled by the get_current_user dependency
    # This middleware can be used for additional processing if needed
    response = await call_next(request)
    return response


def require_admin(request: Request):
    """Decorator to require admin role for certain endpoints."""
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return True
