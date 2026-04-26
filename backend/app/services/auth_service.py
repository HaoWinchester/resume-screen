from datetime import datetime, timedelta
from typing import Optional
import uuid
from passlib.context import CryptContext
from jose import JWTError, jwt

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import User, Company, UserRole

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password: str) -> str:
        return pwd_context.hash(password)

    def create_access_token(self, data: dict) -> str:
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt

    async def get_user_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def get_company_by_name(self, name: str) -> Optional[Company]:
        result = await self.db.execute(
            select(Company).where(Company.name == name)
        )
        return result.scalar_one_or_none()

    async def get_user_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def register(self, email: str, password: str, name: str, company_name: str) -> User:
        # Check if user already exists
        existing_user = await self.get_user_by_email(email)
        if existing_user:
            raise ValueError("EMAIL_ALREADY_EXISTS")

        # Get or create company
        company = await self.get_company_by_name(company_name)
        is_new_company = not company
        if not company:
            company = Company(
                name=company_name,
                industry=None
            )
            self.db.add(company)
            await self.db.flush()

        # Check if this is the first user in the company
        from sqlalchemy import func
        count_result = await self.db.execute(
            select(func.count()).select_from(User).where(User.company_id == company.id)
        )
        user_count = count_result.scalar() or 0

        # Create user - first user in company becomes admin
        user = User(
            email=email,
            password_hash=self.get_password_hash(password),
            name=name,
            role=UserRole.ADMIN if user_count == 0 else UserRole.OPERATOR,
            company_id=company.id,
            is_active=True
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def login(self, email: str, password: str) -> User:
        user = await self.get_user_by_email(email)
        if not user:
            raise ValueError("INVALID_CREDENTIALS")

        if not self.verify_password(password, user.password_hash):
            raise ValueError("INVALID_CREDENTIALS")

        if not user.is_active:
            raise ValueError("USER_INACTIVE")

        return user

    async def reset_password(self, email: str) -> str:
        # Stub implementation - in production, send email with reset link
        user = await self.get_user_by_email(email)
        if user:
            # Generate temporary password
            temp_password = uuid.uuid4().hex[:8]
            user.password_hash = self.get_password_hash(temp_password)
            await self.db.commit()
            return temp_password
        return ""

    def verify_token(self, token: str) -> Optional[dict]:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            return payload
        except JWTError:
            return None
