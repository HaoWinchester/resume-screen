from typing import Optional
from uuid import UUID
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Company, User, UserRole
from app.schemas.company import InviteRequest, UpdateRoleRequest


class CompanyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_company_info(self, company_id: UUID) -> Optional[Company]:
        """Get company information."""
        result = await self.db.execute(
            select(Company).where(Company.id == company_id)
        )
        return result.scalar_one_or_none()

    async def get_members(
        self,
        company_id: UUID,
        page: int = 1,
        per_page: int = 20
    ) -> tuple[list[User], int]:
        """Get company members with pagination."""
        # Get total count
        count_result = await self.db.execute(
            select(func.count()).select_from(User).where(User.company_id == company_id)
        )
        total = count_result.scalar()

        # Get paginated results
        result = await self.db.execute(
            select(User)
            .where(User.company_id == company_id)
            .order_by(User.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
        members = result.scalars().all()

        return list(members), total

    async def invite_member(
        self,
        company_id: UUID,
        inviter: User,
        data: InviteRequest
    ) -> User:
        """
        Invite a new member to the company.

        - Creates a new user with a temporary password
        - In production, this would send an email
        """
        from app.services.auth_service import AuthService
        import secrets

        auth_service = AuthService(self.db)

        # Check if user already exists
        existing_user = await auth_service.get_user_by_email(data.email)
        if existing_user:
            if existing_user.company_id == company_id:
                raise ValueError("USER_ALREADY_IN_COMPANY")
            else:
                raise ValueError("USER_BELONGS_TO_OTHER_COMPANY")

        # Generate temporary password
        temp_password = secrets.token_urlsafe(12)

        # Create user
        user = User(
            email=data.email,
            password_hash=auth_service.get_password_hash(temp_password),
            name=data.name,
            role=UserRole(data.role),
            company_id=company_id,
            is_active=True
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        # In production, send email with temp_password
        # For now, we'll return it (for demo purposes)
        user._temp_password = temp_password

        return user

    async def update_member_role(
        self,
        company_id: UUID,
        user_id: UUID,
        data: UpdateRoleRequest
    ) -> Optional[User]:
        """Update member role (admin only)."""
        # Verify user belongs to company
        result = await self.db.execute(
            select(User).where(
                User.id == user_id,
                User.company_id == company_id
            )
        )
        user = result.scalar_one_or_none()

        if not user:
            return None

        # Update role
        user.role = UserRole(data.role)
        await self.db.commit()
        await self.db.refresh(user)

        return user

    async def remove_member(self, company_id: UUID, user_id: UUID) -> bool:
        """Remove member from company (by deactivating)."""
        result = await self.db.execute(
            select(User).where(
                User.id == user_id,
                User.company_id == company_id
            )
        )
        user = result.scalar_one_or_none()

        if not user:
            return False

        user.is_active = False
        await self.db.commit()
        return True
