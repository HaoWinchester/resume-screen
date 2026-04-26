from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth import RegisterRequest, LoginRequest, ResetPasswordRequest, TokenResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    注册新用户

    - 如果公司不存在则自动创建
    - 公司首个用户为 admin，后续用户为 operator
    - 返回 JWT token
    """
    auth_service = AuthService(db)

    try:
        user = await auth_service.register(
            email=request.email,
            password=request.password,
            name=request.name,
            company_name=request.company_name
        )
    except ValueError as e:
        if str(e) == "EMAIL_ALREADY_EXISTS":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": {"code": "EMAIL_EXISTS", "message": "邮箱已被注册"}}
            )
        raise

    access_token = auth_service.create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role, "company_id": str(user.company_id)}
    )

    return TokenResponse(
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role.value,
            "company_id": user.company_id
        },
        access_token=access_token
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    用户登录

    - 验证邮箱和密码
    - 返回 JWT token
    """
    auth_service = AuthService(db)

    try:
        user = await auth_service.login(
            email=request.email,
            password=request.password
        )
    except ValueError as e:
        if str(e) in ["INVALID_CREDENTIALS", "USER_INACTIVE"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error": {"code": "INVALID_CREDENTIALS", "message": "邮箱或密码错误"}}
            )
        raise

    access_token = auth_service.create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role, "company_id": str(user.company_id)}
    )

    return TokenResponse(
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role.value,
            "company_id": user.company_id
        },
        access_token=access_token
    )


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    密码重置

    - 发送重置邮件（当前为stub实现）
    """
    auth_service = AuthService(db)
    await auth_service.reset_password(request.email)

    return {"message": "密码重置邮件已发送"}
