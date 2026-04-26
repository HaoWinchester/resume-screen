from typing import Optional
from uuid import UUID
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import JobRequirement, JobRequirementStatus, Resume, AnalysisResult, AnalysisStatus
from app.schemas.job_requirement import JobRequirementCreate, JobRequirementUpdate, CriteriaSchema


class JobRequirementService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, job_id: UUID, company_id: UUID) -> Optional[JobRequirement]:
        """Get job requirement by ID with company isolation."""
        result = await self.db.execute(
            select(JobRequirement)
            .where(JobRequirement.id == job_id)
            .where(JobRequirement.company_id == company_id)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        company_id: UUID,
        status_filter: Optional[str] = None,
        page: int = 1,
        per_page: int = 20
    ) -> tuple[list[JobRequirement], int]:
        """List job requirements with filters and pagination."""
        query = select(JobRequirement).where(JobRequirement.company_id == company_id)

        if status_filter:
            query = query.where(JobRequirement.status == status_filter)

        # Get total count
        count_query = select(func.count()).select_from(JobRequirement).where(JobRequirement.company_id == company_id)
        if status_filter:
            count_query = count_query.where(JobRequirement.status == status_filter)

        total_result = await self.db.execute(count_query)
        total = total_result.scalar()

        # Get paginated results
        query = query.order_by(JobRequirement.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
        result = await self.db.execute(query)
        items = result.scalars().all()

        return list(items), total

    async def create(
        self,
        company_id: UUID,
        created_by: UUID,
        data: JobRequirementCreate
    ) -> JobRequirement:
        """Create a new job requirement."""
        # If template_id is provided, copy criteria from template
        criteria_data = data.criteria.dict()
        if data.template_id:
            # Template lookup will be done in the service layer
            pass

        job = JobRequirement(
            title=data.title,
            description=data.description,
            company_id=company_id,
            created_by=created_by,
            template_id=data.template_id,
            status=JobRequirementStatus.DRAFT,
            criteria=criteria_data
        )
        self.db.add(job)
        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def update(
        self,
        job_id: UUID,
        company_id: UUID,
        data: JobRequirementUpdate
    ) -> Optional[JobRequirement]:
        """Update job requirement (partial update)."""
        job = await self.get_by_id(job_id, company_id)
        if not job:
            return None

        update_data = data.dict(exclude_unset=True)
        for field, value in update_data.items():
            if field == "criteria" and value is not None:
                # Convert CriteriaSchema to dict
                job.criteria = value
            else:
                setattr(job, field, value)

        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def delete(self, job_id: UUID, company_id: UUID) -> bool:
        """Delete job requirement (only draft status)."""
        job = await self.get_by_id(job_id, company_id)
        if not job:
            return False

        if job.status != JobRequirementStatus.DRAFT:
            return False

        await self.db.delete(job)
        await self.db.commit()
        return True

    async def activate(self, job_id: UUID, company_id: UUID) -> Optional[JobRequirement]:
        """Activate job requirement. Validates criteria is not empty."""
        job = await self.get_by_id(job_id, company_id)
        if not job:
            return None

        # Validate criteria is not empty
        if not self._validate_criteria_not_empty(job.criteria):
            raise ValueError("EMPTY_CRITERIA")

        job.status = JobRequirementStatus.ACTIVE
        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def close(self, job_id: UUID, company_id: UUID) -> Optional[JobRequirement]:
        """Close job requirement."""
        job = await self.get_by_id(job_id, company_id)
        if not job:
            return None

        job.status = JobRequirementStatus.CLOSED
        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def copy(self, job_id: UUID, company_id: UUID, created_by: UUID) -> Optional[JobRequirement]:
        """Copy job requirement."""
        job = await self.get_by_id(job_id, company_id)
        if not job:
            return None

        new_job = JobRequirement(
            title=f"{job.title} (副本)",
            description=job.description,
            company_id=company_id,
            created_by=created_by,
            template_id=None,
            status=JobRequirementStatus.DRAFT,
            criteria=job.criteria.copy()
        )
        self.db.add(new_job)
        await self.db.commit()
        await self.db.refresh(new_job)
        return new_job

    async def get_with_stats(self, job_id: UUID, company_id: UUID) -> Optional[dict]:
        """Get job requirement with resume and analysis counts."""
        job = await self.get_by_id(job_id, company_id)
        if not job:
            return None

        # Get resume count
        resume_count_result = await self.db.execute(
            select(func.count()).select_from(Resume).where(Resume.job_requirement_id == job_id)
        )
        resume_count = resume_count_result.scalar()

        # Get analyzed count
        analyzed_count_result = await self.db.execute(
            select(func.count())
            .select_from(AnalysisResult)
            .join(Resume, AnalysisResult.resume_id == Resume.id)
            .where(
                Resume.job_requirement_id == job_id,
                AnalysisResult.analysis_status == AnalysisStatus.COMPLETED
            )
        )
        analyzed_count = analyzed_count_result.scalar()

        return {
            "job": job,
            "resume_count": resume_count or 0,
            "analyzed_count": analyzed_count or 0
        }

    def _validate_criteria_not_empty(self, criteria: dict) -> bool:
        """Validate that criteria has at least some content."""
        if not criteria:
            return False

        required_skills = criteria.get("required_skills", [])
        bonus_skills = criteria.get("bonus_skills", [])
        min_experience = criteria.get("min_experience_years")
        education = criteria.get("education")
        industry = criteria.get("industry_preference", [])
        languages = criteria.get("languages", [])
        other = criteria.get("other_requirements")

        # At least one criterion should be set
        has_content = bool(
            required_skills or
            bonus_skills or
            min_experience is not None or
            education or
            industry or
            languages or
            other
        )

        # Weights must be present
        has_weights = "weights" in criteria and criteria["weights"] is not None

        return has_content and has_weights

    @staticmethod
    def get_weight_factor(weight: str) -> int:
        """Get numeric weight factor for calculation."""
        weight_map = {
            "high": 3,
            "medium": 2,
            "low": 1
        }
        return weight_map.get(weight, 1)
