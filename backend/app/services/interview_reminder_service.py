from datetime import datetime, timezone
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AnalysisResult,
    CandidateCommunication,
    CandidateWorkflow,
    Company,
    JobRequirement,
    RecruitmentReminder,
    Resume,
    User as UserModel,
)
from app.services.email_service import EmailService
from app.services.resume_display import get_display_candidate_name, get_resume_basic_info

INTERVIEW_REMINDER_3H = "interview_reminder_3h"
INTERVIEW_REMINDER_1H = "interview_reminder_1h"
INTERVIEW_REMINDER_TYPES = (INTERVIEW_REMINDER_3H, INTERVIEW_REMINDER_1H)


def interview_reminder_label(reminder_type: str) -> str:
    if reminder_type == INTERVIEW_REMINDER_3H:
        return "3小时"
    if reminder_type == INTERVIEW_REMINDER_1H:
        return "1小时"
    return "面试前"


def _mode_label(mode: str | None) -> str:
    labels = {
        "online": "线上面试",
        "offline": "现场面试",
        "phone": "电话面试",
    }
    return labels.get(mode or "", mode or "待确认")


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


async def _get_sender(db: AsyncSession, reminder: RecruitmentReminder) -> UserModel | None:
    if reminder.created_by:
        result = await db.execute(select(UserModel).where(UserModel.id == reminder.created_by))
        user = result.scalar_one_or_none()
        if user:
            return user
    result = await db.execute(
        select(UserModel)
        .where(UserModel.company_id == reminder.company_id, UserModel.is_active.is_(True))
        .order_by(UserModel.created_at.asc())
    )
    return result.scalars().first()


async def dispatch_due_interview_reminders(
    db: AsyncSession,
    *,
    now: datetime | None = None,
    company_id: uuid.UUID | None = None,
) -> dict:
    due_at = now or _now_utc()
    query = select(RecruitmentReminder).where(
        RecruitmentReminder.reminder_type.in_(INTERVIEW_REMINDER_TYPES),
        RecruitmentReminder.status == "pending",
        RecruitmentReminder.due_at <= due_at,
    )
    if company_id:
        query = query.where(RecruitmentReminder.company_id == company_id)

    result = await db.execute(query.order_by(RecruitmentReminder.due_at.asc()))
    reminders = result.scalars().all()
    sent = 0
    failed = 0
    items = []

    for reminder in reminders:
        reminder.status = "sending"
        await db.commit()

        try:
            payload = await _send_one_reminder(db, reminder)
        except Exception as exc:
            failed += 1
            reminder.status = "failed"
            reminder.note = f"{reminder.note or ''}\n发送失败：{exc}".strip()
            await db.commit()
            items.append({"id": str(reminder.id), "status": "failed", "message": str(exc)})
            continue

        sent += 1
        reminder.status = "done"
        reminder.completed_by = payload["sender_id"]
        reminder.completed_at = _now_utc()
        db.add(payload["communication"])
        await db.commit()
        items.append({"id": str(reminder.id), "status": "done", "message": payload["delivery_message"]})

    return {"sent": sent, "failed": failed, "total": len(reminders), "items": items}


async def _send_one_reminder(db: AsyncSession, reminder: RecruitmentReminder) -> dict:
    result = await db.execute(
        select(CandidateWorkflow, AnalysisResult, Resume, JobRequirement, Company)
        .join(AnalysisResult, CandidateWorkflow.analysis_id == AnalysisResult.id)
        .join(Resume, AnalysisResult.resume_id == Resume.id)
        .join(JobRequirement, AnalysisResult.job_requirement_id == JobRequirement.id)
        .join(Company, JobRequirement.company_id == Company.id)
        .where(
            CandidateWorkflow.analysis_id == reminder.analysis_id,
            CandidateWorkflow.company_id == reminder.company_id,
        )
    )
    row = result.one_or_none()
    if not row:
        raise RuntimeError("未找到对应的面试安排")

    workflow, _analysis, resume, job, company = row
    candidate_email = get_resume_basic_info(resume).get("email") or resume.candidate_email
    if not candidate_email:
        raise RuntimeError("候选人没有邮箱，无法发送面试提醒")
    if not workflow.interview_scheduled_at:
        raise RuntimeError("面试时间缺失，无法发送面试提醒")
    if not workflow.interview_location:
        raise RuntimeError("面试地点或会议链接缺失，无法发送面试提醒")

    sender = await _get_sender(db, reminder)
    sender_name = sender.name if sender else "HR"
    contact_name = (company.contact_name or sender_name).strip()
    contact_phone = (company.contact_phone or "").strip()
    if not contact_phone:
        raise RuntimeError("公司联系电话缺失，无法发送面试提醒")
    contact_email = (company.contact_email or "").strip() or (sender.email if sender else None)
    label = interview_reminder_label(reminder.reminder_type)

    email_result = EmailService().send_interview_reminder(
        to_email=candidate_email,
        candidate_name=get_display_candidate_name(resume),
        job_title=job.title,
        scheduled_at=workflow.interview_scheduled_at,
        mode=_mode_label(workflow.interview_mode),
        location=workflow.interview_location,
        reminder_label=label,
        sender_name=sender_name,
        contact_name=contact_name,
        contact_phone=contact_phone,
        contact_email=contact_email,
    )
    subject = f"{job.title} 面试前{label}提醒"
    communication = CandidateCommunication(
        company_id=reminder.company_id,
        analysis_id=workflow.analysis_id,
        channel="email",
        direction="outbound",
        subject=subject,
        content=(
            f"已发送{subject}。面试时间：{workflow.interview_scheduled_at.strftime('%Y-%m-%d %H:%M')}；"
            f"面试地点/会议链接：{workflow.interview_location}；发送结果：{email_result.message}"
        ),
        occurred_at=_now_utc(),
        contact_person=sender_name,
        created_by=sender.id if sender else None,
    )
    return {
        "sender_id": sender.id if sender else None,
        "delivery_message": email_result.message,
        "communication": communication,
    }
