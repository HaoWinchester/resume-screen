from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.database import get_db
from app.api.deps import get_current_user, require_admin, User
from app.services.company_service import CompanyService
from app.schemas.company import (
    CompanyResponse,
    MemberListResponse,
    MemberItem,
    InviteRequest,
    UpdateRoleRequest
)

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("/me", response_model=CompanyResponse)
async def get_company_info(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取当前用户的公司信息"""
    from app.models import Company

    result = await db.execute(
        select(Company).where(Company.id == current_user.company_id)
    )
    company = result.scalar_one_or_none()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "公司不存在"}}
        )

    return {
        "id": company.id,
        "name": company.name,
        "industry": company.industry,
        "created_at": company.created_at
    }


@router.get("/me/members", response_model=MemberListResponse)
async def get_company_members(
    page: int = 1,
    per_page: int = 20,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    获取公司成员列表（管理员）

    - 需要管理员权限
    - 支持分页
    """
    service = CompanyService(db)

    members, total = await service.get_members(
        company_id=current_user.company_id,
        page=page,
        per_page=per_page
    )

    return MemberListResponse(
        members=[
            MemberItem(
                id=m.id,
                name=m.name,
                email=m.email,
                role=m.role.value,
                is_active=m.is_active,
                created_at=m.created_at
            )
            for m in members
        ],
        total=total
    )


@router.post("/me/invite", status_code=status.HTTP_201_CREATED)
async def invite_member(
    data: InviteRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    邀请新成员（管理员）

    - 创建新用户
    - 发送邀请邮件（当前为stub实现）
    - 返回临时密码用于首次登录
    """
    service = CompanyService(db)

    # Validate role
    if data.role not in ["admin", "operator"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "INVALID_ROLE", "message": "角色必须是 admin 或 operator"}}
        )

    try:
        user = await service.invite_member(
            company_id=current_user.company_id,
            inviter=current_user,
            data=data
        )
    except ValueError as e:
        if str(e) == "USER_ALREADY_IN_COMPANY":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": {"code": "USER_EXISTS", "message": "用户已在公司中"}}
            )
        elif str(e) == "USER_BELONGS_TO_OTHER_COMPANY":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": {"code": "USER_IN_OTHER_COMPANY", "message": "用户属于其他公司"}}
            )
        raise

    # In production, send email with temp_password
    # For now, include in response (for demo)
    temp_password = getattr(user, '_temp_password', '***')

    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role.value,
        "temp_password": temp_password,
        "message": "邀请成功，临时密码已生成"
    }


@router.patch("/me/members/{user_id}")
async def update_member_role(
    user_id: uuid.UUID,
    data: UpdateRoleRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    更新成员角色（管理员）

    - 仅管理员可修改
    - 不能修改自己的角色
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "CANNOT_MODIFY_SELF", "message": "不能修改自己的角色"}}
        )

    # Validate role
    if data.role not in ["admin", "operator"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "INVALID_ROLE", "message": "角色必须是 admin 或 operator"}}
        )

    service = CompanyService(db)

    user = await service.update_member_role(
        company_id=current_user.company_id,
        user_id=user_id,
        data=data
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "用户不存在"}}
        )

    return {
        "id": user.id,
        "role": user.role.value
    }


@router.delete("/me/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    user_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    移除成员（管理员）

    - 通过停用账号实现
    - 不能移除自己
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "CANNOT_REMOVE_SELF", "message": "不能移除自己"}}
        )

    service = CompanyService(db)

    success = await service.remove_member(
        company_id=current_user.company_id,
        user_id=user_id
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "用户不存在"}}
        )
