from datetime import datetime, timedelta, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import User, get_current_user
from app.database import get_db
from app.models import (
    AnalysisResult,
    CandidateWorkflow,
    CandidateWorkflowStatus,
    Company,
    JobRequirement,
    RecommendationLevel,
    Resume,
    User as UserModel,
)
from app.models.hr_extension import (
    AuditLog,
    CalendarEvent,
    CandidateCommunication,
    CandidateInterviewFeedback,
    CandidateTag,
    EmailTemplate,
    RecruitmentReminder,
)
from app.services.resume_display import get_display_candidate_name, get_resume_basic_info
from app.services.interview_reminder_service import dispatch_due_interview_reminders

router = APIRouter(prefix="/hr", tags=["hr-extensions"])

DEFAULT_EMAIL_TEMPLATES = [
    {
        "name": "面试邀约通知",
        "template_type": "interview_invitation",
        "subject": "【{{公司名称}}】{{岗位名称}} 面试邀约",
        "body": (
            "{{候选人姓名}}，您好：\n\n"
            "我是 {{公司名称}} 的 {{联系人}}。感谢您关注 {{岗位名称}} 岗位，我们希望邀请您参加下一轮面试。\n\n"
            "面试时间：{{面试时间}}\n"
            "面试形式：{{面试形式}}\n"
            "面试地点/会议链接：{{面试地点或会议链接}}\n\n"
            "如该时间不方便，您可以直接回复邮件，我们会协助调整。\n\n"
            "{{联系人}}\n"
            "{{联系电话}}\n"
            "{{联系邮箱}}"
        ),
        "variables": [
            "候选人姓名",
            "公司名称",
            "岗位名称",
            "面试时间",
            "面试形式",
            "面试地点或会议链接",
            "联系人",
            "联系电话",
            "联系邮箱",
        ],
    },
    {
        "name": "面试前提醒",
        "template_type": "interview_reminder",
        "subject": "【{{公司名称}}】{{岗位名称}} 面试提醒",
        "body": (
            "{{候选人姓名}}，您好：\n\n"
            "温馨提醒，您与 {{公司名称}} 的 {{岗位名称}} 岗位面试将在 {{面试时间}} 开始。\n\n"
            "面试地点/会议链接：{{面试地点或会议链接}}\n"
            "联系人：{{联系人}} {{联系电话}}\n\n"
            "建议您提前 5-10 分钟进入会议或到达现场。如遇特殊情况，请及时与我们联系。"
        ),
        "variables": [
            "候选人姓名",
            "公司名称",
            "岗位名称",
            "面试时间",
            "面试地点或会议链接",
            "联系人",
            "联系电话",
        ],
    },
    {
        "name": "面试改期通知",
        "template_type": "interview_reschedule",
        "subject": "【{{公司名称}}】{{岗位名称}} 面试时间调整",
        "body": (
            "{{候选人姓名}}，您好：\n\n"
            "很抱歉通知您，原定 {{原面试时间}} 的 {{岗位名称}} 岗位面试需要调整。\n\n"
            "新的面试时间：{{新面试时间}}\n"
            "面试地点/会议链接：{{面试地点或会议链接}}\n\n"
            "给您带来的不便我们深感抱歉。如新时间不方便，请回复邮件或联系 {{联系人}}（{{联系电话}}）。"
        ),
        "variables": [
            "候选人姓名",
            "公司名称",
            "岗位名称",
            "原面试时间",
            "新面试时间",
            "面试地点或会议链接",
            "联系人",
            "联系电话",
        ],
    },
    {
        "name": "沟通跟进邮件",
        "template_type": "follow_up",
        "subject": "【{{公司名称}}】{{岗位名称}} 岗位沟通跟进",
        "body": (
            "{{候选人姓名}}，您好：\n\n"
            "感谢您今天与我们沟通 {{岗位名称}} 岗位。根据本次沟通，我们整理了下一步信息：\n\n"
            "{{下一步安排}}\n\n"
            "如果您有补充材料或疑问，也可以直接回复本邮件。\n\n"
            "{{联系人}}\n"
            "{{联系电话}}"
        ),
        "variables": [
            "候选人姓名",
            "公司名称",
            "岗位名称",
            "下一步安排",
            "联系人",
            "联系电话",
        ],
    },
    {
        "name": "候选人婉拒通知",
        "template_type": "rejection",
        "subject": "【{{公司名称}}】{{岗位名称}} 岗位申请反馈",
        "body": (
            "{{候选人姓名}}，您好：\n\n"
            "感谢您对 {{公司名称}} 和 {{岗位名称}} 岗位的关注，也感谢您投入时间参与沟通。\n\n"
            "经过综合评估，我们暂时无法继续推进本次流程。这个决定并不代表对您能力的否定，只是当前岗位需求与您的经历匹配度尚未达到最优。\n\n"
            "后续如有更匹配的机会，我们也期待再次与您沟通。祝您求职顺利。"
        ),
        "variables": ["候选人姓名", "公司名称", "岗位名称"],
    },
    {
        "name": "Offer 意向确认",
        "template_type": "offer_intent",
        "subject": "【{{公司名称}}】{{岗位名称}} Offer 意向确认",
        "body": (
            "{{候选人姓名}}，您好：\n\n"
            "很高兴通知您，经过面试评估，我们希望进一步与您确认 {{岗位名称}} 岗位的 Offer 意向。\n\n"
            "岗位：{{岗位名称}}\n"
            "预计入职时间：{{预计入职时间}}\n"
            "沟通联系人：{{联系人}} {{联系电话}}\n\n"
            "如您仍有意向，请回复本邮件，我们会继续推进后续流程。"
        ),
        "variables": [
            "候选人姓名",
            "公司名称",
            "岗位名称",
            "预计入职时间",
            "联系人",
            "联系电话",
        ],
    },
]

KNOWN_COMPANY_TEMPLATE_VARIABLES = {"公司名称", "联系人", "联系电话", "联系邮箱"}
COMPANY_TEMPLATE_TOKENS = {
    "{{公司名称}}": "company_name",
    "{{联系人}}": "contact_name",
    "{{联系电话}}": "contact_phone",
    "{{联系邮箱}}": "contact_email",
    "{{company_name}}": "company_name",
    "{{contact_name}}": "contact_name",
    "{{contact_phone}}": "contact_phone",
    "{{contact_email}}": "contact_email",
}


def _company_email_template_values(company: Company, current_user: User) -> dict[str, str]:
    return {
        "company_name": (company.name or "").strip() or "当前公司",
        "contact_name": (company.contact_name or "").strip() or current_user.name,
        "contact_phone": (company.contact_phone or "").strip() or "请在基础信息中配置联系电话",
        "contact_email": (company.contact_email or "").strip() or current_user.email,
    }


def _render_company_template(template: dict, values: dict[str, str]) -> dict:
    rendered = dict(template)
    for field in ("subject", "body"):
        text = rendered[field]
        for token, value_key in COMPANY_TEMPLATE_TOKENS.items():
            text = text.replace(token, values[value_key])
        rendered[field] = text
    rendered["variables"] = [
        variable for variable in rendered["variables"] if variable not in KNOWN_COMPANY_TEMPLATE_VARIABLES
    ]
    return rendered


async def _ensure_default_email_templates(db: AsyncSession, current_user: User) -> None:
    company_result = await db.execute(select(Company).where(Company.id == current_user.company_id))
    company = company_result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="公司不存在")

    values = _company_email_template_values(company, current_user)
    default_templates = [_render_company_template(template, values) for template in DEFAULT_EMAIL_TEMPLATES]
    result = await db.execute(
        select(EmailTemplate).where(EmailTemplate.company_id == current_user.company_id)
    )
    existing_templates = {template.name: template for template in result.scalars().all()}
    missing_templates = [
        template for template in default_templates if template["name"] not in existing_templates
    ]
    updated_count = 0
    for template in default_templates:
        existing = existing_templates.get(template["name"])
        if not existing:
            continue
        existing_text = f"{existing.subject}\n{existing.body}"
        if any(token in existing_text for token in COMPANY_TEMPLATE_TOKENS):
            existing.subject = template["subject"]
            existing.body = template["body"]
            existing.variables = template["variables"]
            existing.updated_by = current_user.id
            updated_count += 1

    if not missing_templates and updated_count == 0:
        return

    for template in missing_templates:
        db.add(
            EmailTemplate(
                company_id=current_user.company_id,
                name=template["name"],
                template_type=template["template_type"],
                subject=template["subject"],
                body=template["body"],
                variables=template["variables"],
                is_active=True,
                created_by=current_user.id,
                updated_by=current_user.id,
            )
        )
    await _audit(
        db,
        current_user,
        action="seed_email_templates",
        entity_type="email_template",
        entity_id=None,
        summary=f"同步内置邮件模板，新增 {len(missing_templates)} 个，更新 {updated_count} 个",
    )
    await db.commit()


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="候选人分析不存在")
    return row


async def _candidate_lookup(db: AsyncSession, company_id: uuid.UUID) -> dict[uuid.UUID, dict]:
    result = await db.execute(
        select(AnalysisResult, Resume, JobRequirement)
        .join(Resume, AnalysisResult.resume_id == Resume.id)
        .join(JobRequirement, AnalysisResult.job_requirement_id == JobRequirement.id)
        .where(JobRequirement.company_id == company_id)
    )
    return {
        analysis.id: {
            "analysis_id": str(analysis.id),
            "resume_id": str(resume.id),
            "candidate_name": get_display_candidate_name(resume),
            "candidate_email": get_resume_basic_info(resume).get("email"),
            "job_id": str(job.id),
            "job_title": job.title,
            "score": float(analysis.overall_score),
            "recommendation": analysis.recommendation.value,
        }
        for analysis, resume, job in result.all()
    }


async def _audit(
    db: AsyncSession,
    current_user: User,
    *,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID | str | None,
    summary: str,
    metadata: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            company_id=current_user.company_id,
            actor_user_id=current_user.id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id else None,
            summary=summary,
            audit_metadata=metadata,
        )
    )


def _feedback_payload(item: CandidateInterviewFeedback, context: dict | None = None, interviewer_name: str | None = None) -> dict:
    return {
        "id": str(item.id),
        "analysis_id": str(item.analysis_id),
        "candidate_name": context.get("candidate_name") if context else None,
        "job_title": context.get("job_title") if context else None,
        "interviewer_name": interviewer_name,
        "round_name": item.interview_round,
        "score": item.rating * 20,
        "decision": item.recommendation,
        "strengths": item.strengths or [],
        "risks": item.concerns or [],
        "notes": item.summary,
        "submitted_at": item.created_at,
    }


def _communication_payload(item: CandidateCommunication, context: dict | None = None, owner_name: str | None = None) -> dict:
    return {
        "id": str(item.id),
        "analysis_id": str(item.analysis_id),
        "candidate_name": context.get("candidate_name") if context else None,
        "job_title": context.get("job_title") if context else None,
        "channel": item.channel,
        "direction": item.direction,
        "subject": item.subject,
        "content": item.content,
        "owner_name": owner_name or item.contact_person,
        "contacted_at": item.occurred_at,
        "next_follow_up_at": None,
        "created_at": item.created_at,
    }


async def _ensure_interview_calendar_events(db: AsyncSession, current_user: User) -> None:
    result = await db.execute(
        select(CandidateWorkflow, AnalysisResult, Resume, JobRequirement)
        .join(AnalysisResult, CandidateWorkflow.analysis_id == AnalysisResult.id)
        .join(Resume, AnalysisResult.resume_id == Resume.id)
        .join(JobRequirement, AnalysisResult.job_requirement_id == JobRequirement.id)
        .where(
            CandidateWorkflow.company_id == current_user.company_id,
            CandidateWorkflow.status == CandidateWorkflowStatus.INTERVIEW_SCHEDULED,
            CandidateWorkflow.interview_scheduled_at.is_not(None),
        )
    )
    rows = result.all()
    if not rows:
        return

    existing_result = await db.execute(
        select(CalendarEvent.analysis_id).where(
            CalendarEvent.company_id == current_user.company_id,
            CalendarEvent.provider == "internal_interview",
            CalendarEvent.analysis_id.in_([workflow.analysis_id for workflow, _, _, _ in rows]),
        )
    )
    existing_analysis_ids = set(existing_result.scalars().all())
    created_count = 0
    for workflow, _analysis, resume, job in rows:
        if workflow.analysis_id in existing_analysis_ids or not workflow.interview_scheduled_at:
            continue
        basic_info = get_resume_basic_info(resume)
        attendees = []
        candidate_email = basic_info.get("email") or resume.candidate_email
        if candidate_email:
            attendees.append(candidate_email)
        if current_user.email not in attendees:
            attendees.append(current_user.email)
        db.add(
            CalendarEvent(
                company_id=current_user.company_id,
                analysis_id=workflow.analysis_id,
                title=f"{get_display_candidate_name(resume)} - {job.title} 面试",
                start_at=workflow.interview_scheduled_at,
                end_at=workflow.interview_scheduled_at + timedelta(hours=1),
                location=workflow.interview_location,
                provider="internal_interview",
                attendees=attendees,
                note=workflow.note,
                created_by=current_user.id,
            )
        )
        created_count += 1

    if created_count:
        await _audit(
            db,
            current_user,
            action="sync_calendar_events",
            entity_type="calendar_event",
            entity_id=None,
            summary=f"回补面试日历排期 {created_count} 条",
        )
        await db.commit()


@router.get("/pipeline")
async def get_pipeline(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AnalysisResult, Resume, JobRequirement, CandidateWorkflow)
        .join(Resume, AnalysisResult.resume_id == Resume.id)
        .join(JobRequirement, AnalysisResult.job_requirement_id == JobRequirement.id)
        .outerjoin(CandidateWorkflow, CandidateWorkflow.analysis_id == AnalysisResult.id)
        .where(JobRequirement.company_id == current_user.company_id)
        .order_by(AnalysisResult.created_at.desc())
    )
    rows = result.all()
    total = len(rows)

    stage_defs = [
        ("uploaded", "已入库"),
        ("recommended", "推荐候选人"),
        ("priority", "优先沟通"),
        ("contacted", "已沟通"),
        ("interview_scheduled", "已约面试"),
        ("hired", "已录用"),
    ]
    counts = dict.fromkeys([key for key, _ in stage_defs], 0)
    candidates = []
    for analysis, resume, job, workflow in rows[:100]:
        if workflow:
            stage = workflow.status.value
        elif analysis.recommendation in {RecommendationLevel.STRONGLY_RECOMMENDED, RecommendationLevel.RECOMMENDED}:
            stage = "recommended"
        else:
            stage = "uploaded"
        counts[stage] = counts.get(stage, 0) + 1
        candidates.append(
            {
                "id": str(workflow.id if workflow else analysis.id),
                "analysis_id": str(analysis.id),
                "candidate_name": get_display_candidate_name(resume),
                "job_title": job.title,
                "stage": dict(stage_defs).get(stage, stage),
                "score": float(analysis.overall_score),
                "owner_name": None,
                "updated_at": workflow.updated_at if workflow else analysis.created_at,
            }
        )

    return {
        "summary": [
            {"label": "候选人总数", "value": total},
            {"label": "优先沟通", "value": counts.get("priority", 0)},
            {"label": "已沟通", "value": counts.get("contacted", 0)},
            {"label": "已约面试", "value": counts.get("interview_scheduled", 0)},
        ],
        "stages": [
            {
                "key": key,
                "label": label,
                "count": counts.get(key, 0),
                "conversion_rate": round((counts.get(key, 0) / total) * 100, 1) if total else 0,
                "average_days": None,
            }
            for key, label in stage_defs
        ],
        "candidates": candidates,
        "generated_at": datetime.now(timezone.utc),
    }


@router.get("/communications")
async def list_communications(
    analysis_id: uuid.UUID | None = Query(None),
    channel: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    context = await _candidate_lookup(db, current_user.company_id)
    query = select(CandidateCommunication).where(CandidateCommunication.company_id == current_user.company_id)
    if analysis_id:
        query = query.where(CandidateCommunication.analysis_id == analysis_id)
    if channel:
        query = query.where(CandidateCommunication.channel == channel)
    result = await db.execute(query.order_by(CandidateCommunication.occurred_at.desc()))
    items = [_communication_payload(item, context.get(item.analysis_id)) for item in result.scalars().all()]
    return {"items": items, "total": len(items)}


@router.post("/communications")
async def create_communication(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    analysis_id = uuid.UUID(payload["analysis_id"])
    await _analysis_context(db, current_user.company_id, analysis_id)
    item = CandidateCommunication(
        company_id=current_user.company_id,
        analysis_id=analysis_id,
        channel=payload.get("channel") or "note",
        direction=payload.get("direction") or "outbound",
        subject=payload.get("subject"),
        content=payload.get("content") or payload.get("summary") or "",
        occurred_at=datetime.now(timezone.utc),
        contact_person=current_user.name,
        created_by=current_user.id,
    )
    if not item.content.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="沟通内容不能为空")
    db.add(item)
    await db.flush()
    await _audit(db, current_user, action="create_communication", entity_type="candidate", entity_id=analysis_id, summary="新增候选人沟通记录")
    await db.commit()
    context = await _candidate_lookup(db, current_user.company_id)
    return _communication_payload(item, context.get(item.analysis_id), current_user.name)


@router.get("/interview-feedback")
async def list_interview_feedback(
    analysis_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    context = await _candidate_lookup(db, current_user.company_id)
    user_result = await db.execute(select(UserModel))
    user_map = {user.id: user.name for user in user_result.scalars().all()}
    query = select(CandidateInterviewFeedback).where(CandidateInterviewFeedback.company_id == current_user.company_id)
    if analysis_id:
        query = query.where(CandidateInterviewFeedback.analysis_id == analysis_id)
    result = await db.execute(query.order_by(CandidateInterviewFeedback.created_at.desc()))
    items = [
        _feedback_payload(item, context.get(item.analysis_id), user_map.get(item.interviewer_user_id) or user_map.get(item.created_by))
        for item in result.scalars().all()
    ]
    return {"items": items, "total": len(items)}


@router.post("/interview-feedback")
async def create_interview_feedback(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    analysis_id = uuid.UUID(payload["analysis_id"])
    await _analysis_context(db, current_user.company_id, analysis_id)
    score = int(payload.get("score") or 80)
    item = CandidateInterviewFeedback(
        company_id=current_user.company_id,
        analysis_id=analysis_id,
        interviewer_user_id=current_user.id,
        interview_round=payload.get("round_name") or "一面",
        rating=max(1, min(5, round(score / 20))),
        recommendation=payload.get("decision") or "hold",
        strengths=payload.get("strengths") or [],
        concerns=payload.get("risks") or [],
        summary=payload.get("notes"),
        next_step="根据面试结论推进下一步",
        created_by=current_user.id,
    )
    db.add(item)
    await db.flush()
    await _audit(db, current_user, action="create_interview_feedback", entity_type="interview_feedback", entity_id=item.id, summary="新增面试评价")
    await db.commit()
    context = await _candidate_lookup(db, current_user.company_id)
    return _feedback_payload(item, context.get(item.analysis_id), current_user.name)


@router.get("/tags")
async def list_candidate_tags(
    analysis_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(CandidateTag).where(CandidateTag.company_id == current_user.company_id)
    if analysis_id:
        query = query.where(CandidateTag.analysis_id == analysis_id)
    result = await db.execute(query.order_by(CandidateTag.created_at.desc()))
    items = [
        {
            "id": str(item.id),
            "analysis_id": str(item.analysis_id),
            "tag": item.tag,
            "color": item.color,
            "note": item.note,
            "created_at": item.created_at,
        }
        for item in result.scalars().all()
    ]
    return {"items": items, "total": len(items)}


@router.post("/tags")
async def create_candidate_tag(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    analysis_id = uuid.UUID(payload["analysis_id"])
    await _analysis_context(db, current_user.company_id, analysis_id)
    item = CandidateTag(
        company_id=current_user.company_id,
        analysis_id=analysis_id,
        tag=(payload.get("tag") or "").strip(),
        color=payload.get("color"),
        note=payload.get("note"),
        created_by=current_user.id,
    )
    if not item.tag:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="标签不能为空")
    db.add(item)
    await db.flush()
    await _audit(db, current_user, action="create_candidate_tag", entity_type="candidate", entity_id=analysis_id, summary=f"新增候选人标签：{item.tag}")
    await db.commit()
    return {
        "id": str(item.id),
        "analysis_id": str(item.analysis_id),
        "tag": item.tag,
        "color": item.color,
        "note": item.note,
        "created_at": item.created_at,
    }


@router.get("/email-templates")
async def list_email_templates(
    scenario: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_default_email_templates(db, current_user)
    query = select(EmailTemplate).where(EmailTemplate.company_id == current_user.company_id)
    if scenario:
        query = query.where(EmailTemplate.template_type == scenario)
    result = await db.execute(query.order_by(EmailTemplate.updated_at.desc()))
    items = [
        {
            "id": str(item.id),
            "name": item.name,
            "scenario": item.template_type,
            "subject": item.subject,
            "body": item.body,
            "variables": item.variables or [],
            "is_active": item.is_active,
            "updated_at": item.updated_at,
        }
        for item in result.scalars().all()
    ]
    return {"items": items, "total": len(items)}


@router.post("/email-templates")
async def create_email_template(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = EmailTemplate(
        company_id=current_user.company_id,
        name=payload["name"],
        template_type=payload.get("scenario") or payload.get("template_type") or "general",
        subject=payload["subject"],
        body=payload["body"],
        variables=payload.get("variables") or [],
        is_active=payload.get("is_active", True),
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(item)
    await db.flush()
    await _audit(db, current_user, action="create_email_template", entity_type="email_template", entity_id=item.id, summary=f"创建邮件模板：{item.name}")
    await db.commit()
    return {
        "id": str(item.id),
        "name": item.name,
        "scenario": item.template_type,
        "subject": item.subject,
        "body": item.body,
        "variables": item.variables or [],
        "is_active": item.is_active,
        "updated_at": item.updated_at,
    }


@router.put("/email-templates/{template_id}")
async def update_email_template(
    template_id: uuid.UUID,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(EmailTemplate).where(EmailTemplate.id == template_id, EmailTemplate.company_id == current_user.company_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="邮件模板不存在")
    item.name = payload.get("name", item.name)
    item.template_type = payload.get("scenario") or payload.get("template_type") or item.template_type
    item.subject = payload.get("subject", item.subject)
    item.body = payload.get("body", item.body)
    item.variables = payload.get("variables", item.variables)
    item.is_active = payload.get("is_active", item.is_active)
    item.updated_by = current_user.id
    await _audit(db, current_user, action="update_email_template", entity_type="email_template", entity_id=item.id, summary=f"更新邮件模板：{item.name}")
    await db.commit()
    return {
        "id": str(item.id),
        "name": item.name,
        "scenario": item.template_type,
        "subject": item.subject,
        "body": item.body,
        "variables": item.variables or [],
        "is_active": item.is_active,
        "updated_at": item.updated_at,
    }


@router.get("/reminders")
async def list_reminders(
    reminder_status: str | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    context = await _candidate_lookup(db, current_user.company_id)
    query = select(RecruitmentReminder).where(RecruitmentReminder.company_id == current_user.company_id)
    if reminder_status:
        query = query.where(RecruitmentReminder.status == reminder_status)
    result = await db.execute(query.order_by(RecruitmentReminder.due_at.asc()))
    items = []
    for item in result.scalars().all():
        candidate = context.get(item.analysis_id) if item.analysis_id else None
        items.append(
            {
                "id": str(item.id),
                "title": item.title,
                "description": item.note,
                "candidate_name": candidate.get("candidate_name") if candidate else None,
                "job_title": candidate.get("job_title") if candidate else None,
                "reminder_type": item.reminder_type,
                "due_at": item.due_at,
                "status": item.status,
                "owner_name": None,
            }
        )
    return {"items": items, "total": len(items)}


@router.post("/reminders/dispatch-due")
async def dispatch_reminders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await dispatch_due_interview_reminders(db, company_id=current_user.company_id)
    if result["sent"] or result["failed"]:
        await _audit(
            db,
            current_user,
            action="dispatch_due_reminders",
            entity_type="reminder",
            entity_id=None,
            summary=f"发送到期面试提醒：成功 {result['sent']}，失败 {result['failed']}",
        )
        await db.commit()
    return result


@router.patch("/reminders/{reminder_id}")
async def update_reminder(
    reminder_id: uuid.UUID,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(RecruitmentReminder).where(RecruitmentReminder.id == reminder_id, RecruitmentReminder.company_id == current_user.company_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="提醒不存在")
    item.status = payload.get("status", item.status)
    if item.status == "done":
        item.completed_by = current_user.id
        item.completed_at = datetime.now(timezone.utc)
    await _audit(db, current_user, action="update_reminder", entity_type="reminder", entity_id=item.id, summary=f"更新提醒状态：{item.status}")
    await db.commit()
    return {
        "id": str(item.id),
        "title": item.title,
        "description": item.note,
        "reminder_type": item.reminder_type,
        "due_at": item.due_at,
        "status": item.status,
        "owner_name": None,
    }


@router.get("/calendar")
async def list_calendar(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_interview_calendar_events(db, current_user)
    context = await _candidate_lookup(db, current_user.company_id)
    result = await db.execute(select(CalendarEvent).where(CalendarEvent.company_id == current_user.company_id).order_by(CalendarEvent.start_at.asc()))
    items = []
    for item in result.scalars().all():
        candidate = context.get(item.analysis_id) if item.analysis_id else None
        items.append(
            {
                "id": str(item.id),
                "title": item.title,
                "candidate_name": candidate.get("candidate_name") if candidate else None,
                "job_title": candidate.get("job_title") if candidate else None,
                "starts_at": item.start_at,
                "ends_at": item.end_at,
                "location": item.location,
                "meeting_link": item.location if item.location and item.location.startswith("http") else None,
                "attendees": item.attendees or [],
                "status": "scheduled",
            }
        )
    return {"items": items, "total": len(items)}


@router.post("/jd-optimizer")
async def optimize_jd(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job_id = uuid.UUID(payload["job_requirement_id"])
    result = await db.execute(select(JobRequirement).where(JobRequirement.id == job_id, JobRequirement.company_id == current_user.company_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="岗位不存在")
    criteria = job.criteria or {}
    required_skills = criteria.get("required_skills") or []
    min_years = criteria.get("min_experience_years")
    suggestions = []
    missing_signals = []
    if len(required_skills) > 6:
        suggestions.append("必备技能较多，建议区分“必须掌握”和“可入职后补齐”，提升候选人覆盖率。")
    if min_years and min_years >= 8:
        suggestions.append("最低年限较高，建议补充“能力等价经验”描述，避免错过成长型候选人。")
    if not job.description:
        missing_signals.append("岗位描述为空，建议补充团队背景、核心挑战和面试流程。")
    if not criteria.get("other_requirements"):
        missing_signals.append("缺少软性能力与协作要求描述。")
    tone = payload.get("target_tone") or "professional"
    focus = payload.get("focus")
    optimized_description = job.description or f"我们正在招聘 {job.title}，希望你具备 {', '.join(required_skills[:5]) or '相关岗位'} 经验。"
    if focus:
        suggestions.append(f"本次优化重点：{focus}")
    return {
        "job_requirement_id": str(job.id),
        "original_title": job.title,
        "optimized_title": job.title if tone == "professional" else f"{job.title}（成长与挑战并重）",
        "optimized_description": optimized_description,
        "suggestions": suggestions or ["当前岗位画像基础完整，可继续结合候选人转化数据微调。"],
        "missing_signals": missing_signals,
        "inclusive_language_notes": ["避免使用绝对化表达，如“必须精通所有技术栈”；建议突出团队支持与成长空间。"],
        "generated_at": datetime.now(timezone.utc),
    }


@router.get("/audit")
async def list_audit_logs(
    action: str | None = Query(None),
    resource_type: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(AuditLog, UserModel).outerjoin(UserModel, AuditLog.actor_user_id == UserModel.id).where(AuditLog.company_id == current_user.company_id)
    if action:
        query = query.where(AuditLog.action.contains(action))
    if resource_type:
        query = query.where(AuditLog.entity_type == resource_type)
    result = await db.execute(query.order_by(AuditLog.created_at.desc()))
    items = [
        {
            "id": str(log.id),
            "actor_name": user.name if user else None,
            "action": log.action,
            "resource_type": log.entity_type,
            "resource_id": log.entity_id,
            "summary": log.summary,
            "ip_address": None,
            "created_at": log.created_at,
        }
        for log, user in result.all()
    ]
    return {"items": items, "total": len(items)}
