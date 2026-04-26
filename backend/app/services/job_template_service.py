from typing import Optional
from uuid import UUID
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import JobTemplate, JobRequirement
from app.schemas.job_template import JobTemplateCreate, JobTemplateUpdate


class JobTemplateService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, template_id: UUID, company_id: UUID) -> Optional[JobTemplate]:
        """Get template by ID with company isolation."""
        result = await self.db.execute(
            select(JobTemplate)
            .where(JobTemplate.id == template_id)
            .where(JobTemplate.company_id == company_id)
        )
        return result.scalar_one_or_none()

    async def list(self, company_id: UUID) -> list[JobTemplate]:
        """List all templates for a company."""
        result = await self.db.execute(
            select(JobTemplate)
            .where(JobTemplate.company_id == company_id)
            .order_by(JobTemplate.created_at.desc())
        )
        return list(result.scalars().all())

    async def create(
        self,
        company_id: UUID,
        created_by: UUID,
        data: JobTemplateCreate
    ) -> JobTemplate:
        """Create a new template."""
        template = JobTemplate(
            name=data.name,
            company_id=company_id,
            created_by=created_by,
            content=data.content.dict()
        )
        self.db.add(template)
        await self.db.commit()
        await self.db.refresh(template)
        return template

    async def update(
        self,
        template_id: UUID,
        company_id: UUID,
        data: JobTemplateUpdate
    ) -> Optional[JobTemplate]:
        """Update template (partial update)."""
        template = await self.get_by_id(template_id, company_id)
        if not template:
            return None

        update_data = data.dict(exclude_unset=True)
        for field, value in update_data.items():
            if field == "content" and value is not None:
                template.content = value
            else:
                setattr(template, field, value)

        await self.db.commit()
        await self.db.refresh(template)
        return template

    async def delete(self, template_id: UUID, company_id: UUID) -> bool:
        """Delete template."""
        template = await self.get_by_id(template_id, company_id)
        if not template:
            return False

        await self.db.delete(template)
        await self.db.commit()
        return True

    async def create_from_job_requirement(
        self,
        job_id: UUID,
        company_id: UUID,
        created_by: UUID,
        template_name: str
    ) -> Optional[JobTemplate]:
        """Create a template from an existing job requirement."""
        # Get job requirement
        result = await self.db.execute(
            select(JobRequirement)
            .where(JobRequirement.id == job_id)
            .where(JobRequirement.company_id == company_id)
        )
        job = result.scalar_one_or_none()

        if not job:
            return None

        template = JobTemplate(
            name=template_name,
            company_id=company_id,
            created_by=created_by,
            content=job.criteria.copy()
        )
        self.db.add(template)
        await self.db.commit()
        await self.db.refresh(template)
        return template
