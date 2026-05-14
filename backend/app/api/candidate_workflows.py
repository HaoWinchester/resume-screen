from datetime import datetime, timedelta, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import User, get_current_user
from app.database import get_db
from app.models import (
    AnalysisResult,
    CandidateWorkflow,
    CandidateWorkflowAction,
    CandidateWorkflowEvent,
    CandidateWorkflowStatus,
    CalendarEvent,
    CandidateCommunication,
    Company,
    JobRequirement,
    RecruitmentReminder,
    Resume,
)
from app.schemas.candidate_workflow import (
    CandidateWorkflowItem,
    CandidateWorkflowListResponse,
    MarkContactedRequest,
    ScheduleInterviewRequest,
    WorkflowNoteRequest,
)
from app.services.email_service import EmailService
from app.services.interview_reminder_service import INTERVIEW_REMINDER_1H, INTERVIEW_REMINDER_3H
from app.services.resume_display import get_display_candidate_name, get_resume_basic_info

router = APIRouter(prefix="/candidate-workflows", tags=["candidate-workflows"])


async def _get_company_analysis(db: AsyncSession, company_id: uuid.UUID, analysis_id: uuid.UUID) -> AnalysisResult:
    result = await db.execute(
        select(AnalysisResult)
        .join(JobRequirement, AnalysisResult.job_requirement_id == JobRequirement.id)
        .where(AnalysisResult.id == analysis_id, JobRequirement.company_id == company_id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "候选人分析不存在"}},
        )
    return analysis


async def _analysis_context(
    db: AsyncSession,
    company_id: uuid.UUID,
    analysis_id: uuid.UUID,
) -> tuple[AnalysisResult, Resume, JobRequirement]:
    result = await db.execute(
        select(AnalysisResult, Resume, JobRequirement)
        .join(Resume, AnalysisResult.resume_id == Resume.id)
        .join(JobRequirement, AnalysisResult.job_requirement_id == JobRequirement.id)
        .where(AnalysisResult.id == analysis_id, JobRequirement.company_id == company_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "候选人分析不存在"}},
        )
    return row


async def _get_or_create_workflow(db: AsyncSession, current_user: User, analysis_id: uuid.UUID) -> CandidateWorkflow:
    await _get_company_analysis(db, current_user.company_id, analysis_id)
    result = await db.execute(select(CandidateWorkflow).where(CandidateWorkflow.analysis_id == analysis_id))
    workflow = result.scalar_one_or_none()
    if workflow:
        return workflow

    workflow = CandidateWorkflow(
        analysis_id=analysis_id,
        company_id=current_user.company_id,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(workflow)
    await db.flush()
    return workflow


def _mode_label(mode: str | None) -> str:
    labels = {
        "online": "线上面试",
        "offline": "现场面试",
        "phone": "电话面试",
    }
    return labels.get(mode or "", mode or "待确认")


async def _get_company_contact(db: AsyncSession, company_id: uuid.UUID) -> tuple[str, str, str | None]:
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="公司不存在")

    contact_name = (company.contact_name or "").strip()
    contact_phone = (company.contact_phone or "").strip()
    contact_email = (company.contact_email or "").strip() or None
    if not contact_name or not contact_phone:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先在基础信息中配置联系人和联系电话，再保存面试安排")

    return contact_name, contact_phone, contact_email


def _event(
    workflow: CandidateWorkflow,
    action: CandidateWorkflowAction,
    user_id: uuid.UUID,
    *,
    note: str | None = None,
    scheduled_at: datetime | None = None,
    event_metadata: dict | None = None,
) -> CandidateWorkflowEvent:
    return CandidateWorkflowEvent(
        workflow_id=workflow.id,
        action=action,
        note=note,
        scheduled_at=scheduled_at,
        event_metadata=event_metadata,
        created_by=user_id,
    )


def _latest_interview_delivery(workflow: CandidateWorkflow) -> tuple[bool | None, str | None]:
    events = sorted(workflow.events, key=lambda item: item.created_at, reverse=True)
    for event in events:
        if event.action != CandidateWorkflowAction.SCHEDULE_INTERVIEW:
            continue
        metadata = event.event_metadata if isinstance(event.event_metadata, dict) else {}
        return metadata.get("email_sent"), metadata.get("email_message")
    return None, None


async def _upsert_interview_calendar_event(
    db: AsyncSession,
    *,
    current_user: User,
    analysis_id: uuid.UUID,
    candidate_name: str,
    candidate_email: str,
    job_title: str,
    scheduled_at: datetime,
    location: str,
    note: str | None,
    contact_email: str | None,
) -> CalendarEvent:
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.company_id == current_user.company_id,
            CalendarEvent.analysis_id == analysis_id,
            CalendarEvent.provider == "internal_interview",
        )
    )
    event = result.scalar_one_or_none()
    attendees = [candidate_email]
    if contact_email and contact_email not in attendees:
        attendees.append(contact_email)
    if current_user.email not in attendees:
        attendees.append(current_user.email)

    if not event:
        event = CalendarEvent(
            company_id=current_user.company_id,
            analysis_id=analysis_id,
            provider="internal_interview",
            created_by=current_user.id,
        )
        db.add(event)

    event.title = f"{candidate_name} - {job_title} 面试"
    event.start_at = scheduled_at
    event.end_at = scheduled_at + timedelta(hours=1)
    event.location = location
    event.attendees = attendees
    event.note = note
    return event


async def _upsert_interview_reminders(
    db: AsyncSession,
    *,
    current_user: User,
    analysis_id: uuid.UUID,
    job_requirement_id: uuid.UUID,
    candidate_name: str,
    candidate_email: str,
    job_title: str,
    scheduled_at: datetime,
    location: str,
    mode: str,
) -> list[RecruitmentReminder]:
    reminder_specs = [
        (INTERVIEW_REMINDER_3H, "面试前3小时提醒", scheduled_at - timedelta(hours=3)),
        (INTERVIEW_REMINDER_1H, "面试前1小时提醒", scheduled_at - timedelta(hours=1)),
    ]
    result = await db.execute(
        select(RecruitmentReminder).where(
            RecruitmentReminder.company_id == current_user.company_id,
            RecruitmentReminder.analysis_id == analysis_id,
            RecruitmentReminder.reminder_type.in_([item[0] for item in reminder_specs]),
            RecruitmentReminder.status.in_(["pending", "failed", "sending"]),
        )
    )
    existing = {item.reminder_type: item for item in result.scalars().all()}
    reminders = []
    for reminder_type, label, due_at in reminder_specs:
        reminder = existing.get(reminder_type)
        if not reminder:
            reminder = RecruitmentReminder(
                company_id=current_user.company_id,
                analysis_id=analysis_id,
                job_requirement_id=job_requirement_id,
                reminder_type=reminder_type,
                created_by=current_user.id,
            )
            db.add(reminder)
        reminder.title = f"{label}：{candidate_name}"
        reminder.due_at = due_at
        reminder.status = "pending"
        reminder.completed_at = None
        reminder.completed_by = None
        reminder.note = (
            f"候选人邮箱：{candidate_email}；岗位：{job_title}；"
            f"面试时间：{scheduled_at.strftime('%Y-%m-%d %H:%M')}；"
            f"面试形式：{_mode_label(mode)}；面试地点/会议链接：{location}"
        )
        reminders.append(reminder)
    return reminders


def _add_communication_record(
    *,
    workflow: CandidateWorkflow,
    current_user: User,
    channel: str,
    direction: str,
    subject: str,
    content: str,
    occurred_at: datetime,
) -> CandidateCommunication:
    return CandidateCommunication(
        company_id=current_user.company_id,
        analysis_id=workflow.analysis_id,
        channel=channel,
        direction=direction,
        subject=subject,
        content=content,
        occurred_at=occurred_at,
        contact_person=current_user.name,
        created_by=current_user.id,
    )


def _serialize(
    workflow: CandidateWorkflow,
    analysis: AnalysisResult | None = None,
    resume: Resume | None = None,
    job: JobRequirement | None = None,
) -> CandidateWorkflowItem:
    events = sorted(workflow.events, key=lambda item: item.created_at, reverse=True)
    email_sent, email_delivery_message = _latest_interview_delivery(workflow)
    basic_info = get_resume_basic_info(resume) if resume else {}
    return CandidateWorkflowItem(
        id=workflow.id,
        analysis_id=workflow.analysis_id,
        status=workflow.status.value,
        candidate_name=get_display_candidate_name(resume) if resume else None,
        candidate_email=basic_info.get("email"),
        job_title=job.title if job else None,
        score=float(analysis.overall_score) if analysis else None,
        email_sent=email_sent,
        email_delivery_message=email_delivery_message,
        is_priority=workflow.is_priority,
        contact_count=workflow.contact_count,
        last_contacted_at=workflow.last_contacted_at,
        interview_scheduled_at=workflow.interview_scheduled_at,
        interview_mode=workflow.interview_mode,
        interview_location=workflow.interview_location,
        next_step=workflow.next_step,
        note=workflow.note,
        updated_at=workflow.updated_at,
        events=[
            {
                "id": event.id,
                "action": event.action.value,
                "note": event.note,
                "event_metadata": event.event_metadata,
                "scheduled_at": event.scheduled_at,
                "created_at": event.created_at,
            }
            for event in events
        ],
    )


@router.get("", response_model=CandidateWorkflowListResponse)
async def list_candidate_workflows(
    analysis_ids: str | None = Query(None, description="逗号分隔的分析 ID"),
    job_requirement_id: uuid.UUID | None = Query(None),
    workflow_status: str | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(CandidateWorkflow, AnalysisResult, Resume, JobRequirement)
        .options(selectinload(CandidateWorkflow.events))
        .join(AnalysisResult, CandidateWorkflow.analysis_id == AnalysisResult.id)
        .join(Resume, AnalysisResult.resume_id == Resume.id)
        .join(JobRequirement, AnalysisResult.job_requirement_id == JobRequirement.id)
        .where(JobRequirement.company_id == current_user.company_id)
    )
    if analysis_ids:
        parsed_ids = [uuid.UUID(item.strip()) for item in analysis_ids.split(",") if item.strip()]
        query = query.where(CandidateWorkflow.analysis_id.in_(parsed_ids))
    if job_requirement_id:
        query = query.where(AnalysisResult.job_requirement_id == job_requirement_id)
    if workflow_status:
        try:
            query = query.where(CandidateWorkflow.status == CandidateWorkflowStatus(workflow_status))
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="工作流状态不正确") from exc

    result = await db.execute(query.order_by(CandidateWorkflow.updated_at.desc()))
    rows = result.unique().all()
    return {"items": [_serialize(workflow, analysis, resume, job) for workflow, analysis, resume, job in rows]}


@router.get("/{analysis_id}", response_model=CandidateWorkflowItem)
async def get_candidate_workflow(
    analysis_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    analysis, resume, job = await _analysis_context(db, current_user.company_id, analysis_id)
    workflow = await _get_or_create_workflow(db, current_user, analysis_id)
    await db.commit()
    await db.refresh(workflow, attribute_names=["events"])
    return _serialize(workflow, analysis, resume, job)


@router.post("/{analysis_id}/priority", response_model=CandidateWorkflowItem)
async def mark_priority(
    analysis_id: uuid.UUID,
    payload: WorkflowNoteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    analysis, resume, job = await _analysis_context(db, current_user.company_id, analysis_id)
    workflow = await _get_or_create_workflow(db, current_user, analysis_id)
    workflow.is_priority = True
    if workflow.status == CandidateWorkflowStatus.NEW:
        workflow.status = CandidateWorkflowStatus.PRIORITY
    workflow.note = payload.note or workflow.note
    workflow.next_step = "优先联系候选人"
    workflow.updated_by = current_user.id
    db.add(_event(workflow, CandidateWorkflowAction.MARK_PRIORITY, current_user.id, note=payload.note))
    await db.commit()
    await db.refresh(workflow, attribute_names=["events"])
    return _serialize(workflow, analysis, resume, job)


@router.post("/{analysis_id}/contact", response_model=CandidateWorkflowItem)
async def mark_contacted(
    analysis_id: uuid.UUID,
    payload: MarkContactedRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    analysis, resume, job = await _analysis_context(db, current_user.company_id, analysis_id)
    workflow = await _get_or_create_workflow(db, current_user, analysis_id)
    contacted_at = payload.contacted_at or datetime.now(timezone.utc)
    workflow.is_priority = True
    if workflow.status in {CandidateWorkflowStatus.NEW, CandidateWorkflowStatus.PRIORITY}:
        workflow.status = CandidateWorkflowStatus.CONTACTED
    workflow.contact_count += 1
    workflow.last_contacted_at = contacted_at
    workflow.note = payload.note or workflow.note
    if workflow.status == CandidateWorkflowStatus.INTERVIEW_SCHEDULED:
        workflow.next_step = "等待候选人参加面试"
    else:
        workflow.next_step = "等待候选人回复或安排面试"
    workflow.updated_by = current_user.id
    db.add(
        _add_communication_record(
            workflow=workflow,
            current_user=current_user,
            channel="phone",
            direction="outbound",
            subject="候选人沟通跟进",
            content=payload.note or "HR 已完成一次候选人沟通",
            occurred_at=contacted_at,
        )
    )
    db.add(_event(workflow, CandidateWorkflowAction.MARK_CONTACTED, current_user.id, note=payload.note, scheduled_at=contacted_at))
    await db.commit()
    await db.refresh(workflow, attribute_names=["events"])
    return _serialize(workflow, analysis, resume, job)


@router.post("/{analysis_id}/interview", response_model=CandidateWorkflowItem)
async def schedule_interview(
    analysis_id: uuid.UUID,
    payload: ScheduleInterviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    analysis, resume, job = await _analysis_context(db, current_user.company_id, analysis_id)
    location = (payload.location or "").strip()
    if not location:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请填写面试地点或会议链接后再保存面试安排")

    candidate_email = str(payload.candidate_email) if payload.candidate_email else get_resume_basic_info(resume).get("email")
    if not candidate_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该面试者没有邮箱，请输入邮箱后再保存面试安排")

    if resume.candidate_email != candidate_email:
        resume.candidate_email = candidate_email

    workflow = await _get_or_create_workflow(db, current_user, analysis_id)
    interview_mode = payload.mode or "online"
    contact_name, contact_phone, contact_email = await _get_company_contact(db, current_user.company_id)
    try:
        email_result = EmailService().send_interview_invitation(
            to_email=candidate_email,
            candidate_name=get_display_candidate_name(resume),
            job_title=job.title,
            scheduled_at=payload.scheduled_at,
            mode=_mode_label(interview_mode),
            location=location,
            note=payload.note,
            sender_name=current_user.name,
            contact_name=contact_name,
            contact_phone=contact_phone,
            contact_email=contact_email,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="面试通知邮件发送失败，请稍后重试") from exc

    workflow.is_priority = True
    workflow.status = CandidateWorkflowStatus.INTERVIEW_SCHEDULED
    workflow.interview_scheduled_at = payload.scheduled_at
    workflow.interview_mode = interview_mode
    workflow.interview_location = location
    workflow.note = payload.note or workflow.note
    workflow.next_step = "等待候选人参加面试"
    workflow.updated_by = current_user.id
    await _upsert_interview_calendar_event(
        db,
        current_user=current_user,
        analysis_id=analysis_id,
        candidate_name=get_display_candidate_name(resume),
        candidate_email=candidate_email,
        job_title=job.title,
        scheduled_at=payload.scheduled_at,
        location=location,
        note=payload.note,
        contact_email=contact_email,
    )
    await _upsert_interview_reminders(
        db,
        current_user=current_user,
        analysis_id=analysis_id,
        job_requirement_id=job.id,
        candidate_name=get_display_candidate_name(resume),
        candidate_email=candidate_email,
        job_title=job.title,
        scheduled_at=payload.scheduled_at,
        location=location,
        mode=interview_mode,
    )
    db.add(
        _add_communication_record(
            workflow=workflow,
            current_user=current_user,
            channel="email",
            direction="outbound",
            subject=f"{job.title} 面试邀约",
            content=(
                f"已为候选人发送面试邀约。面试时间：{payload.scheduled_at.strftime('%Y-%m-%d %H:%M')}；"
                f"面试形式：{_mode_label(interview_mode)}；面试地点/会议链接：{location}；"
                f"发送结果：{email_result.message}"
            ),
            occurred_at=datetime.now(timezone.utc),
        )
    )
    db.add(
        _event(
            workflow,
            CandidateWorkflowAction.SCHEDULE_INTERVIEW,
            current_user.id,
            note=payload.note,
            scheduled_at=payload.scheduled_at,
            event_metadata={
                "mode": workflow.interview_mode,
                "location": workflow.interview_location,
                "candidate_email": candidate_email,
                "email_sent": email_result.sent,
                "email_mode": email_result.mode,
                "email_message": email_result.message,
                "contact_name": contact_name,
                "contact_phone": contact_phone,
                "contact_email": contact_email,
            },
        )
    )
    await db.commit()
    await db.refresh(workflow, attribute_names=["events"])
    return _serialize(workflow, analysis, resume, job)


@router.post("/{analysis_id}/notes", response_model=CandidateWorkflowItem)
async def add_note(
    analysis_id: uuid.UUID,
    payload: WorkflowNoteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not payload.note:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "VALIDATION_ERROR", "message": "备注不能为空"}},
        )
    workflow = await _get_or_create_workflow(db, current_user, analysis_id)
    analysis, resume, job = await _analysis_context(db, current_user.company_id, analysis_id)
    workflow.note = payload.note
    workflow.updated_by = current_user.id
    db.add(_event(workflow, CandidateWorkflowAction.ADD_NOTE, current_user.id, note=payload.note))
    await db.commit()
    await db.refresh(workflow, attribute_names=["events"])
    return _serialize(workflow, analysis, resume, job)
