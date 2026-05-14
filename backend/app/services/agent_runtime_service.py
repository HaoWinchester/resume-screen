from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any
import uuid

import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import set_committed_value

from app.models import (
    AgentRun,
    AgentRunStatus,
    AgentRunStep,
    AgentRunStepStatus,
    AnalysisResult,
    DimensionScore,
    JobRequirement,
    Resume,
    User,
)
from app.services.ai_analyzer import AIAnalyzer


class AgentRuntimeService:
    """Product-side agent team runtime.

    The first runtime slice is intentionally conservative: agents generate
    suggestions and audit notes, but do not mutate candidate workflow status,
    send emails, or schedule interviews.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo_root = Path(__file__).resolve().parents[3]
        self.team_root = self.repo_root / "product_agents" / "recruitment"
        self.team_config = self._load_team_config()

    async def create_run(
        self,
        *,
        current_user: User,
        task_type: str,
        target_type: str,
        target_id: uuid.UUID,
        task_prompt: str | None = None,
        context: dict | None = None,
    ) -> AgentRun:
        if target_type != "analysis":
            raise ValueError("当前只支持 target_type=analysis")

        await self._build_analysis_context(current_user.company_id, target_id)

        prompt = task_prompt or "生成候选人下一步处理建议、面试问题、沟通草稿和人工审核点。"
        if context:
            prompt = f"{prompt}\n\n补充上下文：{json.dumps(context, ensure_ascii=False)}"

        run = AgentRun(
            company_id=current_user.company_id,
            task_type=task_type,
            target_type=target_type,
            target_id=target_id,
            task_prompt=prompt,
            status=AgentRunStatus.PENDING,
            created_by=current_user.id,
        )
        self.db.add(run)
        await self.db.commit()
        await self.db.refresh(run)
        return run

    async def ensure_run_for_analysis(
        self,
        *,
        company_id: uuid.UUID,
        analysis_id: uuid.UUID,
        created_by: uuid.UUID | None = None,
        task_type: str = "candidate_next_step",
        task_prompt: str | None = None,
        context: dict | None = None,
        fresh_after: datetime | None = None,
    ) -> tuple[AgentRun, bool]:
        """Create one product-side agent run for a completed analysis if needed."""
        await self._build_analysis_context(company_id, analysis_id)

        existing_query = (
            select(AgentRun)
            .where(
                AgentRun.company_id == company_id,
                AgentRun.task_type == task_type,
                AgentRun.target_type == "analysis",
                AgentRun.target_id == analysis_id,
            )
            .order_by(AgentRun.created_at.desc())
            .limit(1)
        )
        if fresh_after:
            existing_query = existing_query.where(AgentRun.created_at >= fresh_after)

        existing = (await self.db.execute(existing_query)).scalar_one_or_none()
        if existing:
            await self._attach_steps([existing])
            return existing, False

        prompt = task_prompt or "分析完成后自动生成候选人下一步处理建议、面试问题、沟通草稿和人工审核点。"
        if context:
            prompt = f"{prompt}\n\n补充上下文：{json.dumps(context, ensure_ascii=False)}"

        run = AgentRun(
            company_id=company_id,
            task_type=task_type,
            target_type="analysis",
            target_id=analysis_id,
            task_prompt=prompt,
            status=AgentRunStatus.PENDING,
            created_by=created_by,
        )
        self.db.add(run)
        await self.db.commit()
        await self.db.refresh(run)
        return run, True

    async def get_company_run(self, company_id: uuid.UUID, run_id: uuid.UUID) -> AgentRun | None:
        result = await self.db.execute(
            select(AgentRun).where(AgentRun.id == run_id, AgentRun.company_id == company_id)
        )
        run = result.scalar_one_or_none()
        if run:
            await self._attach_steps([run])
        return run

    async def list_runs(
        self,
        *,
        company_id: uuid.UUID,
        target_type: str | None = None,
        target_id: uuid.UUID | None = None,
        limit: int = 20,
    ) -> list[AgentRun]:
        query = (
            select(AgentRun)
            .where(AgentRun.company_id == company_id)
            .order_by(AgentRun.created_at.desc())
            .limit(limit)
        )
        if target_type:
            query = query.where(AgentRun.target_type == target_type)
        if target_id:
            query = query.where(AgentRun.target_id == target_id)

        result = await self.db.execute(query)
        runs = list(result.scalars().all())
        await self._attach_steps(runs)
        return runs

    async def execute_run(self, run_id: uuid.UUID) -> AgentRun:
        result = await self.db.execute(
            select(AgentRun).where(AgentRun.id == run_id)
        )
        run = result.scalar_one_or_none()
        if not run:
            raise ValueError("Agent run 不存在")

        run.status = AgentRunStatus.RUNNING
        run.error = None
        await self.db.commit()

        try:
            context = await self._build_analysis_context(run.company_id, run.target_id)
            flow = self._resolve_flow(run.task_type)
            previous_outputs: list[dict[str, Any]] = []

            for index, agent_name in enumerate(flow, start=1):
                run.current_agent = agent_name
                input_packet = self._build_input_packet(run, context, previous_outputs, agent_name)
                step = AgentRunStep(
                    run_id=run.id,
                    step_index=index,
                    agent_name=agent_name,
                    status=AgentRunStepStatus.RUNNING,
                    input_packet=input_packet,
                )
                self.db.add(step)
                await self.db.commit()
                await self.db.refresh(step)

                try:
                    output = await self._run_agent(agent_name, input_packet, context)
                    step.output = output
                    step.summary = self._step_summary(output)
                    step.status = AgentRunStepStatus.COMPLETED
                    step.completed_at = datetime.now(timezone.utc)
                    previous_outputs.append({"agent_name": agent_name, "output": output})
                    await self.db.commit()
                except Exception as exc:
                    step.status = AgentRunStepStatus.FAILED
                    step.error = str(exc)
                    step.completed_at = datetime.now(timezone.utc)
                    run.status = AgentRunStatus.FAILED
                    run.error = f"{agent_name}: {exc}"
                    run.completed_at = datetime.now(timezone.utc)
                    await self.db.commit()
                    return await self._get_run_with_steps(run.id) or run

            run.status = AgentRunStatus.COMPLETED
            run.current_agent = None
            run.result = self._build_final_result(previous_outputs)
            run.completed_at = datetime.now(timezone.utc)
            await self.db.commit()
            return await self._get_run_with_steps(run.id) or run
        except Exception as exc:
            run.status = AgentRunStatus.FAILED
            run.error = str(exc)
            run.completed_at = datetime.now(timezone.utc)
            await self.db.commit()
            return await self._get_run_with_steps(run.id) or run

    async def _get_run_with_steps(self, run_id: uuid.UUID) -> AgentRun | None:
        result = await self.db.execute(
            select(AgentRun).where(AgentRun.id == run_id)
        )
        run = result.scalar_one_or_none()
        if run:
            await self._attach_steps([run])
        return run

    async def _attach_steps(self, runs: list[AgentRun]) -> None:
        if not runs:
            return

        run_ids = [run.id for run in runs]
        result = await self.db.execute(
            select(AgentRunStep)
            .where(AgentRunStep.run_id.in_(run_ids))
            .order_by(AgentRunStep.step_index.asc())
        )
        steps_by_run: dict[uuid.UUID, list[AgentRunStep]] = {}
        for step in result.scalars().all():
            steps_by_run.setdefault(step.run_id, []).append(step)

        for run in runs:
            set_committed_value(run, "steps", steps_by_run.get(run.id, []))

    def _load_team_config(self) -> dict:
        with (self.team_root / "team.yaml").open("r", encoding="utf-8") as handle:
            return yaml.safe_load(handle)

    def _resolve_flow(self, task_type: str) -> list[str]:
        handoffs = self.team_config.get("handoffs", {})
        flow = handoffs.get(task_type) or handoffs.get("candidate_next_step")
        if not flow:
            raise ValueError(f"未配置 agent flow: {task_type}")
        return list(flow)

    async def _build_analysis_context(self, company_id: uuid.UUID, analysis_id: uuid.UUID) -> dict:
        result = await self.db.execute(
            select(AnalysisResult, Resume, JobRequirement)
            .join(Resume, AnalysisResult.resume_id == Resume.id)
            .join(JobRequirement, AnalysisResult.job_requirement_id == JobRequirement.id)
            .where(AnalysisResult.id == analysis_id, JobRequirement.company_id == company_id)
        )
        row = result.one_or_none()
        if not row:
            raise ValueError("候选人分析不存在或无权访问")

        analysis, resume, job = row
        dimension_result = await self.db.execute(
            select(DimensionScore).where(DimensionScore.analysis_id == analysis.id)
        )
        dimensions = {
            item.dimension.value if hasattr(item.dimension, "value") else str(item.dimension): item.match_details
            for item in dimension_result.scalars().all()
        }

        return {
            "analysis": {
                "id": str(analysis.id),
                "overall_score": float(analysis.overall_score or 0),
                "recommendation": analysis.recommendation.value if hasattr(analysis.recommendation, "value") else str(analysis.recommendation),
                "recommendation_reason": analysis.recommendation_reason,
                "strengths": analysis.strengths or [],
                "weaknesses": analysis.weaknesses or [],
                "dimensions": dimensions,
            },
            "resume": {
                "id": str(resume.id),
                "candidate_name": resume.candidate_name or (resume.parsed_data or {}).get("name"),
                "candidate_email": resume.candidate_email or (resume.parsed_data or {}).get("email"),
                "candidate_phone": resume.candidate_phone or (resume.parsed_data or {}).get("phone"),
                "parsed_data": resume.parsed_data or {},
            },
            "job": {
                "id": str(job.id),
                "title": job.title,
                "description": job.description,
                "criteria": job.criteria or {},
            },
        }

    def _build_input_packet(
        self,
        run: AgentRun,
        context: dict,
        previous_outputs: list[dict[str, Any]],
        agent_name: str,
    ) -> dict:
        return {
            "goal": run.task_prompt,
            "task_type": run.task_type,
            "target": {
                "type": run.target_type,
                "id": str(run.target_id),
            },
            "agent_name": agent_name,
            "context": context,
            "previous_outputs": previous_outputs,
            "constraints": [
                "只生成建议和草稿，不自动修改候选人状态",
                "不自动发送邮件",
                "不自动安排面试",
                "所有高影响动作必须由 HR 人工确认",
            ],
        }

    async def _run_agent(self, agent_name: str, input_packet: dict, context: dict) -> dict:
        agent_content = self._read_agent_content(agent_name)
        prompt = self._build_model_prompt(agent_name, agent_content, input_packet)

        try:
            analyzer = AIAnalyzer()
            for provider in analyzer._resolve_provider_order():
                if provider == "local":
                    return self._local_agent_output(agent_name, input_packet, context)
                try:
                    return await analyzer._call_provider(provider, prompt)
                except Exception:
                    continue
        except Exception:
            pass

        return self._local_agent_output(agent_name, input_packet, context)

    def _read_agent_content(self, agent_name: str) -> str:
        path = self.team_root / f"{agent_name}.md"
        if not path.exists():
            raise ValueError(f"Agent 定义不存在: {agent_name}")
        return path.read_text(encoding="utf-8")

    def _build_model_prompt(self, agent_name: str, agent_content: str, input_packet: dict) -> str:
        return f"""你正在 ResumeAssistant 产品运行时中执行招聘业务 Agent。

当前 Agent: {agent_name}

Agent 角色说明:
{agent_content}

输入包:
{json.dumps(input_packet, ensure_ascii=False, indent=2)}

请严格按该 Agent 文件中的“输出”JSON结构返回。
只返回 JSON，不要包含 Markdown、解释文字或代码块。
"""

    def _local_agent_output(self, agent_name: str, input_packet: dict, context: dict) -> dict:
        analysis = context["analysis"]
        resume = context["resume"]
        job = context["job"]
        score = float(analysis.get("overall_score") or 0)
        candidate_name = resume.get("candidate_name") or "候选人"
        job_title = job.get("title") or "当前岗位"
        strengths = self._as_list(analysis.get("strengths"))
        weaknesses = self._as_list(analysis.get("weaknesses"))
        recommendation = self._recommendation_from_score(score)

        if agent_name == "orchestrator-agent":
            return {
                "summary": f"围绕 {candidate_name} 与 {job_title} 的匹配结果生成下一步处理建议。",
                "recommended_flow": ["candidate-review-agent", "interview-agent", "communication-agent", "audit-agent"],
                "human_review_required": True,
                "constraints": ["不得自动改变候选人状态", "不得自动发送邮件", "不得自动安排面试"],
            }

        if agent_name == "candidate-review-agent":
            label = self._recommendation_label(recommendation)
            return {
                "recommendation": recommendation,
                "recommendation_label": label,
                "summary": analysis.get("recommendation_reason")
                or f"{candidate_name} 当前综合评分 {score:.0f} 分，建议 HR 结合岗位要求进行人工复核后决定下一步。",
                "strengths": strengths[:5] or ["简历已完成结构化分析，可基于岗位要求继续复核。"],
                "risks": weaknesses[:5] or ["仍需面试验证项目真实性、职责边界和沟通意愿。"],
                "next_actions": self._next_actions(recommendation),
            }

        if agent_name == "interview-agent":
            focus = weaknesses[:3] or ["项目真实性", "岗位核心技能深度", "近期职责边界"]
            return {
                "summary": f"已为 {candidate_name} 生成围绕 {job_title} 的面试验证重点和追问问题。",
                "focus_areas": focus,
                "questions": [
                    {
                        "area": "岗位匹配",
                        "question": f"请结合你最近一段经历，说明哪些工作最能证明你胜任 {job_title}？",
                        "good_signal": "能对应岗位要求说明个人职责、交付结果和量化影响。",
                        "risk_signal": "只描述团队成果，无法说明个人贡献或关键决策。",
                    },
                    {
                        "area": "风险验证",
                        "question": f"针对简历中相对薄弱的部分，请举一个你补足或快速学习的具体例子。",
                        "good_signal": "能说明学习路径、实际项目应用和复盘结果。",
                        "risk_signal": "回答停留在概念层，缺少项目证据。",
                    },
                ],
                "pre_interview_notes": ["面试前建议准备岗位要求、简历项目和当前评分维度。"],
            }

        if agent_name == "communication-agent":
            return {
                "candidate_message_draft": (
                    f"{candidate_name}，您好。我们看到了您与 {job_title} 岗位相关的经历，"
                    "希望进一步了解您的项目经验和求职意向。方便的话，请回复您近期可沟通的时间。"
                ),
                "internal_note": f"建议 HR 先人工复核评分和风险点，再决定是否发送沟通消息。当前建议：{self._recommendation_label(recommendation)}。",
                "manual_confirmation": "发送前请确认候选人邮箱/联系方式、岗位名称、沟通时间窗口和公司对外口径。",
            }

        if agent_name == "audit-agent":
            return {
                "final_summary": f"{candidate_name} 的综合评分为 {score:.0f} 分，系统建议为：{self._recommendation_label(recommendation)}。所有建议需由 HR 人工确认后执行。",
                "recommended_next_step": recommendation,
                "human_review_points": [
                    "确认候选人联系方式和沟通意愿",
                    "复核岗位必备技能与风险点",
                    "确认是否进入优先沟通或保持观察",
                ],
                "audit_notes": [
                    "本次 agent run 只生成建议和草稿",
                    "未自动修改候选人状态",
                    "未自动发送邮件或安排面试",
                ],
                "safe_to_auto_apply": False,
            }

        return {"summary": "未识别的 agent，已使用本地兜底输出。"}

    def _recommendation_from_score(self, score: float) -> str:
        if score >= 80:
            return "priority_contact"
        if score >= 65:
            return "keep_warm"
        if score >= 50:
            return "hold"
        return "reject_review"

    def _recommendation_label(self, recommendation: str) -> str:
        return {
            "priority_contact": "建议优先沟通",
            "keep_warm": "建议保持观察",
            "hold": "建议暂缓推进",
            "reject_review": "建议人工复核淘汰",
        }.get(recommendation, "建议人工复核")

    def _next_actions(self, recommendation: str) -> list[str]:
        if recommendation == "priority_contact":
            return ["加入优先沟通名单", "准备面试验证问题", "由 HR 确认后发送沟通消息"]
        if recommendation == "keep_warm":
            return ["保留在候选池", "补充核验关键技能", "等待更匹配岗位或进一步沟通"]
        if recommendation == "hold":
            return ["暂缓推进", "标记需要补充信息", "如岗位紧急可由 HR 人工复核"]
        return ["由 HR 人工复核是否淘汰", "记录主要不匹配原因", "避免系统自动拒绝候选人"]

    def _build_final_result(self, outputs: list[dict[str, Any]]) -> dict:
        by_agent = {item["agent_name"]: item["output"] for item in outputs}
        audit = by_agent.get("audit-agent", {})
        review = by_agent.get("candidate-review-agent", {})
        return {
            "summary": audit.get("final_summary") or review.get("summary"),
            "recommended_next_step": audit.get("recommended_next_step") or review.get("recommendation"),
            "safe_to_auto_apply": bool(audit.get("safe_to_auto_apply", False)),
            "human_review_points": audit.get("human_review_points", []),
            "agent_outputs": by_agent,
        }

    def _step_summary(self, output: dict) -> str:
        for key in ("final_summary", "summary", "recommendation_label", "internal_note"):
            value = output.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

        questions = output.get("questions")
        if isinstance(questions, list) and questions:
            return f"已生成 {len(questions)} 个面试验证问题。"

        focus_areas = output.get("focus_areas")
        if isinstance(focus_areas, list) and focus_areas:
            return "已生成面试验证重点。"

        return "该 Agent 已完成处理。"

    def _as_list(self, value: Any) -> list[str]:
        if not value:
            return []
        if isinstance(value, list):
            return [str(item) for item in value if str(item).strip()]
        return [str(value)]
