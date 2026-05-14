import json
import math
import re
from typing import Any
from datetime import date
from anthropic import Anthropic
from openai import OpenAI
import asyncio

from app.config import get_settings


class AIAnalyzer:
    """Resume analysis service using Claude, OpenAI, and a configurable local fallback."""

    # Weight factors for score calculation
    WEIGHT_FACTORS = {
        "high": 3,
        "medium": 2,
        "low": 1
    }

    def __init__(self):
        self.settings = get_settings()
        self.anthropic_client = Anthropic(api_key=self.settings.ANTHROPIC_API_KEY) if self.settings.ANTHROPIC_API_KEY else None
        self.openai_client = OpenAI(api_key=self.settings.OPENAI_API_KEY) if self.settings.OPENAI_API_KEY else None
        self.zhipu_client = (
            OpenAI(
                api_key=self.settings.ZHIPU_API_KEY,
                base_url=self.settings.ZHIPU_BASE_URL,
            )
            if self.settings.ZHIPU_API_KEY
            else None
        )

    def build_analysis_prompt(self, job_criteria: dict, resume_data: dict) -> str:
        """
        Build a structured prompt for AI analysis.

        The prompt instructs the AI to:
        1. Evaluate 5 dimensions (skill_match, experience_match, education, project_relevance, overall_quality)
        2. Provide scores (0-100) for each dimension
        3. Provide analysis text explaining each score
        4. Identify matched/missing skills
        5. List strengths and weaknesses
        6. Return structured JSON
        """
        required_skills = job_criteria.get("required_skills", [])
        bonus_skills = job_criteria.get("bonus_skills", [])
        min_experience = job_criteria.get("min_experience_years", 0)
        education_level = job_criteria.get("education", "")
        industry_pref = job_criteria.get("industry_preference", [])
        job_title = job_criteria.get("job_title", "")
        job_description = job_criteria.get("job_description", "")
        other_requirements = job_criteria.get("other_requirements", "")
        weights = job_criteria.get("weights", {})

        resume_skills = resume_data.get("skills", [])
        resume_education = resume_data.get("education", [])
        resume_experience = resume_data.get("work_experience", [])
        resume_projects = resume_data.get("projects", [])
        resume_raw_text = self._clip_text(str(resume_data.get("raw_text") or ""), 12000)

        prompt = f"""你是一位专业的人力资源分析师，负责评估候选人与岗位要求的匹配度。

请仔细阅读以下岗位要求和候选人简历，给出专业的分析评估。

## 岗位要求

**岗位名称**: {job_title or '未提供'}
**岗位职责/描述**:
{job_description or '未提供'}
**必需技能**: {', '.join(required_skills) if required_skills else '无'}
**加分技能**: {', '.join(bonus_skills) if bonus_skills else '无'}
**最低工作年限**: {min_experience} 年
**学历要求**: {education_level if education_level else '无'}
**偏好行业**: {', '.join(industry_pref) if industry_pref else '无'}
**其他要求**: {other_requirements or '无'}

**评分权重**:
- 技能匹配度 (skill_match): {weights.get('skill_match', 'medium')}
- 经验匹配度 (experience_match): {weights.get('experience_match', 'medium')}
- 教育背景 (education): {weights.get('education', 'medium')}
- 项目相关性 (project_relevance): {weights.get('project_relevance', 'medium')}
- 整体质量 (overall_quality): {weights.get('overall_quality', 'medium')}

## 候选人简历

**姓名**: {resume_data.get('name', '未知')}
**邮箱**: {resume_data.get('email', '未知')}
**当前/核心岗位**: {resume_data.get('current_title') or resume_data.get('target_position') or '未知'}
**工作年限**: {resume_data.get('years_of_experience') or '未知'}
**候选人摘要**: {resume_data.get('summary') or '无'}

**技能**: {', '.join(resume_skills) if resume_skills else '无'}

**教育背景**:
{self._format_education(resume_education)}

**工作经验**:
{self._format_experience(resume_experience)}

**项目经历**:
{self._format_projects(resume_projects)}

**补充信息**:
{self._format_resume_extras(resume_data)}

**简历原文节选**:
{resume_raw_text or '无'}

## 分析要求

请按照以下维度进行评估（每个维度0-100分）：

1. **技能匹配度 (skill_match)**: 评估候选人掌握的技能与岗位必需技能和加分技能的匹配程度
2. **经验匹配度 (experience_match)**: 评估候选人的工作经验年限和相关经验与岗位要求的匹配度
3. **教育背景 (education)**: 评估候选人的学历和专业背景与岗位要求的匹配度
4. **项目相关性 (project_relevance)**: 评估候选人项目经验与岗位需求的相关性
5. **整体质量 (overall_quality)**: 评估简历的整体质量、完整性和专业度

每个维度都必须结合“岗位职责/描述 + 必需技能 + 加分技能 + 其他要求 + 简历原文信息”给出多维评价，不允许只写一句泛泛评价。
每个维度必须包含：
- evidence: 2-4 条来自简历的匹配证据，必须能对应岗位职责或技能要求
- concerns: 1-3 条待验证风险或信息缺口，没有明显风险也要说明“建议面试验证”
- interview_questions: 2-3 个面试追问问题，用于验证该维度真实能力
- next_actions: 1-3 条 HR 后续动作建议
- job_focus: 1-3 条该维度对应的岗位关注点

总体结果必须包含：
- recommendation_reason: 80-160 字中文推荐理由，说明是否值得优先沟通、主要匹配证据和最大风险
- strengths: 3-6 条结合岗位要求的优势
- weaknesses: 2-5 条结合岗位要求的风险/短板

请严格按照以下JSON格式返回分析结果：

```json
{{
  "skill_match": {{
    "score": 85,
    "analysis": "候选人掌握了大部分必需技能...",
    "matched_skills": ["React", "TypeScript"],
    "missing_skills": ["Node.js"],
    "bonus_skills_matched": ["Docker"],
    "job_focus": ["岗位需要 React 与 TypeScript 工程化能力"],
    "evidence": ["简历技能清单明确包含 React 与 TypeScript"],
    "concerns": ["Node.js 服务端经验未在简历中明确体现"],
    "interview_questions": ["请说明最近一个 React 项目的架构设计和性能优化实践。"],
    "next_actions": ["技术面重点验证 Node.js 与前后端协作深度。"]
  }},
  "experience_match": {{
    "score": 75,
    "analysis": "候选人有5年工作经验...",
    "years_of_experience": 5,
    "relevant_years": 3,
    "job_focus": ["岗位要求 3 年以上相关经验"],
    "evidence": ["简历显示候选人有 5 年后端开发经验"],
    "concerns": ["最近一段经历的团队规模和职责边界需要确认"],
    "interview_questions": ["请介绍你在最近岗位中承担的核心职责和交付结果。"],
    "next_actions": ["面试中确认其独立负责模块与跨团队协作经验。"]
  }},
  "education": {{
    "score": 80,
    "analysis": "候选人有本科学历...",
    "degree_match": true,
    "job_focus": ["岗位要求本科及以上学历"],
    "evidence": ["简历显示本科，计算机相关专业"],
    "concerns": ["无需重点担忧，可核验学历真实性"],
    "interview_questions": ["请说明教育背景中与当前岗位最相关的课程或训练。"],
    "next_actions": ["入职前按流程核验学历信息。"]
  }},
  "project_relevance": {{
    "score": 90,
    "analysis": "候选人参与的项目与岗位高度相关...",
    "relevant_projects": 2,
    "job_focus": ["岗位需要复杂项目落地经验"],
    "evidence": ["候选人项目包含高并发平台建设"],
    "concerns": ["项目指标和个人贡献比例需要追问"],
    "interview_questions": ["请拆解一个最相关项目中你的个人贡献、难点和结果。"],
    "next_actions": ["要求候选人面试前准备一个代表项目复盘。"]
  }},
  "overall_quality": {{
    "score": 85,
    "analysis": "简历结构清晰，内容完整...",
    "job_focus": ["简历需要支撑岗位核心职责判断"],
    "evidence": ["简历包含技能、经历、项目和教育信息"],
    "concerns": ["部分成果缺少量化指标"],
    "interview_questions": ["请补充简历中最能证明岗位胜任力的一项成果。"],
    "next_actions": ["沟通时要求补充项目指标、团队规模和个人职责边界。"]
  }},
  "recommendation_reason": "候选人与岗位核心技能和项目经历匹配度较高，建议优先沟通；但需要在面试中验证某些关键技能的实际深度和项目贡献比例。",
  "strengths": ["技能完全匹配", "项目经验丰富"],
  "weaknesses": ["缺少某些加分技能", "无管理经验"]
}}
```

请只返回JSON，不要包含其他文字说明。
"""
        return prompt

    def _format_education(self, education: list) -> str:
        if not education:
            return "无"

        result = []
        for edu in education[:3]:  # Limit to 3 entries
            description = str(edu.get("description") or "").strip()
            line = f"- {edu.get('school', '未知学校')}: {edu.get('degree', '未知学历')} {edu.get('major', '')}"
            if description:
                line = f"{line}；{self._clip_text(description, 180)}"
            result.append(line)
        return "\n".join(result)

    def _format_experience(self, experience: list) -> str:
        if not experience:
            return "无"

        result = []
        for exp in experience[:3]:  # Limit to 3 entries
            details = self._join_detail_fields(
                exp.get("description"),
                exp.get("responsibilities"),
                exp.get("achievements"),
                exp.get("technologies"),
            )
            period = self._date_range(exp.get("start_date"), exp.get("end_date"))
            result.append(
                f"- {exp.get('company', '未知公司')}: {exp.get('position', '未知职位')}"
                f"{period}\n  {self._clip_text(details, 420) if details else '无详细描述'}"
            )
        return "\n".join(result)

    def _format_projects(self, projects: list) -> str:
        if not projects:
            return "无"

        result = []
        for proj in projects[:3]:  # Limit to 3 entries
            details = self._join_detail_fields(
                proj.get("description"),
                proj.get("responsibilities"),
                proj.get("achievements"),
                proj.get("technologies"),
            )
            period = self._date_range(proj.get("start_date"), proj.get("end_date"))
            role = f" / {proj.get('role')}" if proj.get("role") else ""
            result.append(
                f"- {proj.get('name', '未知项目')}{role}{period}: "
                f"{self._clip_text(details, 420) if details else '无详细描述'}"
            )
        return "\n".join(result)

    def _format_resume_extras(self, resume_data: dict) -> str:
        lines: list[str] = []
        for label, key in (
            ("期望岗位", "target_position"),
            ("所在地", "location"),
            ("期望薪资", "expected_salary"),
            ("到岗时间", "availability"),
            ("自我评价", "self_evaluation"),
        ):
            value = resume_data.get(key)
            if value not in (None, "", []):
                lines.append(f"- {label}: {value}")

        certificates = resume_data.get("certificates")
        if isinstance(certificates, list) and certificates:
            lines.append(f"- 证书: {self._clip_text(json.dumps(certificates[:6], ensure_ascii=False), 600)}")

        languages = resume_data.get("languages")
        if isinstance(languages, list) and languages:
            lines.append(f"- 语言: {self._clip_text(json.dumps(languages[:6], ensure_ascii=False), 400)}")

        awards = resume_data.get("awards")
        if isinstance(awards, list) and awards:
            lines.append(f"- 奖项: {'；'.join(str(item) for item in awards[:8] if str(item).strip())}")

        return "\n".join(lines) if lines else "无"

    def _join_detail_fields(self, *values: Any) -> str:
        chunks: list[str] = []
        for value in values:
            if isinstance(value, list):
                chunks.extend(str(item).strip() for item in value if str(item).strip())
            elif value not in (None, "", []):
                chunks.append(str(value).strip())
        return "；".join(chunk for chunk in chunks if chunk)

    def _date_range(self, start: Any, end: Any) -> str:
        start_text = str(start or "").strip()
        end_text = str(end or "").strip()
        if not start_text and not end_text:
            return ""
        return f"（{start_text or '未知'} - {end_text or '至今'}）"

    def _clip_text(self, value: str, max_length: int) -> str:
        text = re.sub(r"\s+", " ", value).strip()
        if len(text) <= max_length:
            return text
        return f"{text[:max_length].rstrip()}..."

    async def call_claude_api(self, prompt: str) -> dict:
        """Call Claude API (primary channel)."""
        if not self.anthropic_client:
            raise ValueError("Claude API not configured")

        try:
            message = self.anthropic_client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=4096,
                temperature=0,
                messages=[{"role": "user", "content": prompt}]
            )

            content = message.content[0].text
            return self.parse_ai_response(content)
        except Exception as e:
            raise ValueError(f"Claude API error: {str(e)}")

    async def call_openai_api(self, prompt: str) -> dict:
        """Call OpenAI API (fallback channel)."""
        if not self.openai_client:
            raise ValueError("OpenAI API not configured")

        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=4096
            )

            content = response.choices[0].message.content
            return self.parse_ai_response(content)
        except Exception as e:
            raise ValueError(f"OpenAI API error: {str(e)}")

    async def call_zhipu_api(self, prompt: str) -> dict:
        """Call Zhipu GLM through the OpenAI-compatible API."""
        if not self.zhipu_client:
            raise ValueError("Zhipu API not configured")

        try:
            response = self.zhipu_client.chat.completions.create(
                model=self.settings.ZHIPU_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=4096,
            )

            content = response.choices[0].message.content
            return self.parse_ai_response(content)
        except Exception as e:
            raise ValueError(f"Zhipu API error: {str(e)}")

    def parse_ai_response(self, content: str) -> dict:
        """Parse AI response and extract JSON."""
        try:
            # Try to extract JSON from response
            content = content.strip()

            # Remove markdown code blocks if present
            if content.startswith("```json"):
                content = content[7:]
            elif content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]

            content = content.strip()
            return json.loads(content)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse AI response as JSON: {str(e)}")

    def calculate_overall_score(self, dimension_scores: dict, weights: dict) -> float:
        """
        Calculate overall score using weighted average formula.

        Formula: overall_score = Σ(dimension_score × weight_factor) / Σ(weight_factor)
        """
        weighted_sum = 0
        total_weight = 0

        for dimension, score_data in dimension_scores.items():
            if isinstance(score_data, dict) and "score" in score_data:
                score = score_data["score"]
                weight = weights.get(dimension, "medium")
                weight_factor = self.WEIGHT_FACTORS.get(weight, 2)

                weighted_sum += score * weight_factor
                total_weight += weight_factor

        if total_weight == 0:
            return 0.0

        return round(weighted_sum / total_weight, 2)

    async def analyze_resume(self, job_criteria: dict, resume_data: dict) -> dict:
        """
        Analyze resume using AI.

        Returns structured analysis with dimension scores, strengths, weaknesses.
        """
        prompt = self.build_analysis_prompt(job_criteria, resume_data)
        errors = []
        provider_order = self._resolve_provider_order()

        for provider in provider_order:
            if provider == "local":
                return self.build_local_analysis(job_criteria, resume_data)

            try:
                result = await self._call_provider(provider, prompt)
                return self.normalize_analysis_result(result, job_criteria, resume_data)
            except Exception as e:
                errors.append(f"{provider}={e}")
                print(f"{provider} analysis failed: {e}")

        if self.settings.AI_ENABLE_LOCAL_FALLBACK:
            print(f"AI services unavailable, using local fallback: {'; '.join(errors)}")
            return self.build_local_analysis(job_criteria, resume_data)

        raise ValueError(f"All AI services failed: {'; '.join(errors)}")

    def _resolve_provider_order(self) -> list[str]:
        provider = self.settings.AI_PROVIDER.strip().lower()
        available = {"anthropic", "openai", "zhipu", "local"}

        if provider in available:
            return [provider]

        configured_order = [
            item.strip().lower()
            for item in self.settings.AI_PROVIDER_ORDER.split(",")
            if item.strip().lower() in available
        ]
        return configured_order or ["zhipu", "openai", "anthropic"]

    async def _call_provider(self, provider: str, prompt: str) -> dict:
        if provider == "anthropic":
            return await self.call_claude_api(prompt)
        if provider == "openai":
            return await self.call_openai_api(prompt)
        if provider == "zhipu":
            return await self.call_zhipu_api(prompt)
        raise ValueError(f"Unknown AI provider: {provider}")

    def normalize_analysis_result(self, result: dict, job_criteria: dict, resume_data: dict) -> dict:
        """Normalize provider output so downstream pages always receive a stable shape."""
        if not isinstance(result, dict):
            return self.build_local_analysis(job_criteria, resume_data)

        fallback = None
        normalized = dict(result)
        dimensions = [
            "skill_match",
            "experience_match",
            "education",
            "project_relevance",
            "overall_quality",
        ]

        for dimension in dimensions:
            dimension_data = normalized.get(dimension)
            if not isinstance(dimension_data, dict) or "score" not in dimension_data:
                fallback = fallback or self.build_local_analysis(job_criteria, resume_data)
                normalized[dimension] = fallback[dimension]
                continue

            dimension_data = dict(dimension_data)
            dimension_data["score"] = self._clamp_score(self._to_number(dimension_data.get("score")))
            dimension_data.setdefault("analysis", "模型未返回该维度的文字分析。")
            fallback_dimension = None
            for key in ("job_focus", "evidence", "concerns", "interview_questions", "next_actions"):
                values = self._as_text_list(dimension_data.get(key))
                if not values:
                    fallback = fallback or self.build_local_analysis(job_criteria, resume_data)
                    fallback_dimension = fallback_dimension or fallback[dimension]
                    values = self._as_text_list(fallback_dimension.get(key))
                dimension_data[key] = self._dedupe_text_list(values)
            normalized[dimension] = dimension_data

        strengths = self._as_text_list(normalized.get("strengths"))
        weaknesses = self._as_text_list(normalized.get("weaknesses"))

        for dimension in dimensions:
            dimension_data = normalized.get(dimension, {})
            if isinstance(dimension_data, dict):
                strengths.extend(self._as_text_list(dimension_data.get("strengths")))
                weaknesses.extend(self._as_text_list(dimension_data.get("weaknesses")))

        if not strengths or not weaknesses:
            fallback = fallback or self.build_local_analysis(job_criteria, resume_data)
            if not strengths:
                strengths = fallback["strengths"]
            if not weaknesses:
                weaknesses = fallback["weaknesses"]

        normalized["strengths"] = self._dedupe_text_list(strengths)
        normalized["weaknesses"] = self._dedupe_text_list(weaknesses)
        normalized["recommendation_reason"] = self._build_recommendation_reason(
            normalized,
            job_criteria,
            resume_data,
        )
        return normalized

    def build_local_analysis(self, job_criteria: dict, resume_data: dict) -> dict:
        """
        Build a deterministic analysis when external AI providers are unavailable.

        This keeps the upload -> parse -> analyze flow usable in demos and customer
        environments that have not configured an AI API key yet.
        """
        required_skills = self._as_list(job_criteria.get("required_skills"))
        bonus_skills = self._as_list(job_criteria.get("bonus_skills"))
        industry_preference = self._as_list(job_criteria.get("industry_preference"))
        min_experience = self._to_number(job_criteria.get("min_experience_years"))

        resume_skills = self._as_list(resume_data.get("skills"))
        resume_text = self._flatten_text(resume_data)
        resume_skill_text = self._flatten_text(resume_skills)

        matched_skills = [
            skill for skill in required_skills
            if self._term_matches(skill, resume_skills, resume_text)
        ]
        missing_skills = [
            skill for skill in required_skills
            if skill not in matched_skills
        ]
        bonus_skills_matched = [
            skill for skill in bonus_skills
            if self._term_matches(skill, resume_skills, resume_text)
        ]

        skill_score = self._calculate_skill_score(
            required_skills,
            bonus_skills,
            matched_skills,
            bonus_skills_matched,
            resume_skills,
        )

        years_of_experience = self._estimate_years_of_experience(resume_data)
        experience_score = self._calculate_experience_score(years_of_experience, min_experience)

        education_entries = self._as_list(resume_data.get("education"))
        required_education = job_criteria.get("education")
        education_score, degree_match = self._calculate_education_score(
            required_education,
            education_entries,
        )

        relevant_projects = self._count_relevant_projects(
            resume_data.get("projects", []),
            required_skills + bonus_skills + industry_preference,
            resume_skill_text,
        )
        project_score = self._calculate_project_score(
            resume_data.get("projects", []),
            relevant_projects,
            required_skills + bonus_skills + industry_preference,
        )

        overall_quality_score = self._calculate_resume_quality_score(resume_data)
        job_focus = self._build_job_focus(job_criteria)
        evidence = self._build_resume_evidence(resume_data, required_skills + bonus_skills + industry_preference)

        strengths = self._build_strengths(
            skill_score,
            experience_score,
            education_score,
            project_score,
            matched_skills,
            bonus_skills_matched,
            years_of_experience,
            min_experience,
            degree_match,
        )
        weaknesses = self._build_weaknesses(
            missing_skills,
            experience_score,
            education_score,
            project_score,
            years_of_experience,
            min_experience,
            resume_data,
        )

        return {
            "skill_match": {
                "score": skill_score,
                "analysis": self._skill_analysis_text(skill_score, matched_skills, missing_skills, bonus_skills_matched),
                "matched_skills": matched_skills,
                "missing_skills": missing_skills,
                "bonus_skills_matched": bonus_skills_matched,
                "job_focus": self._dimension_job_focus("skill_match", job_criteria, job_focus),
                "evidence": self._skill_evidence(matched_skills, bonus_skills_matched, resume_skills),
                "concerns": self._skill_concerns(missing_skills),
                "interview_questions": self._dimension_questions("skill_match", matched_skills + bonus_skills_matched, missing_skills),
                "next_actions": self._dimension_actions("skill_match", skill_score),
            },
            "experience_match": {
                "score": experience_score,
                "analysis": self._experience_analysis_text(experience_score, years_of_experience, min_experience),
                "years_of_experience": years_of_experience,
                "relevant_years": min(years_of_experience, min_experience) if min_experience else years_of_experience,
                "job_focus": self._dimension_job_focus("experience_match", job_criteria, job_focus),
                "evidence": self._experience_evidence(resume_data, years_of_experience),
                "concerns": self._experience_concerns(years_of_experience, min_experience),
                "interview_questions": self._dimension_questions("experience_match", [], []),
                "next_actions": self._dimension_actions("experience_match", experience_score),
            },
            "education": {
                "score": education_score,
                "analysis": self._education_analysis_text(education_score, required_education, education_entries, degree_match),
                "degree_match": degree_match,
                "job_focus": self._dimension_job_focus("education", job_criteria, job_focus),
                "evidence": self._education_evidence(education_entries),
                "concerns": self._education_concerns(required_education, degree_match),
                "interview_questions": self._dimension_questions("education", [], []),
                "next_actions": self._dimension_actions("education", education_score),
            },
            "project_relevance": {
                "score": project_score,
                "analysis": self._project_analysis_text(project_score, relevant_projects),
                "relevant_projects": relevant_projects,
                "job_focus": self._dimension_job_focus("project_relevance", job_criteria, job_focus),
                "evidence": self._project_evidence(resume_data.get("projects", []), evidence),
                "concerns": self._project_concerns(project_score, relevant_projects),
                "interview_questions": self._dimension_questions("project_relevance", required_skills + bonus_skills, []),
                "next_actions": self._dimension_actions("project_relevance", project_score),
            },
            "overall_quality": {
                "score": overall_quality_score,
                "analysis": self._quality_analysis_text(overall_quality_score),
                "job_focus": self._dimension_job_focus("overall_quality", job_criteria, job_focus),
                "evidence": self._quality_evidence(resume_data),
                "concerns": self._quality_concerns(resume_data),
                "interview_questions": self._dimension_questions("overall_quality", [], []),
                "next_actions": self._dimension_actions("overall_quality", overall_quality_score),
            },
            "recommendation_reason": self._build_local_recommendation_reason(
                skill_score,
                experience_score,
                project_score,
                matched_skills,
                missing_skills,
                job_criteria,
            ),
            "strengths": strengths,
            "weaknesses": weaknesses,
        }

    def _build_job_focus(self, job_criteria: dict) -> list[str]:
        focus: list[str] = []
        job_title = job_criteria.get("job_title")
        if job_title:
            focus.append(f"岗位名称：{job_title}")
        description = str(job_criteria.get("job_description") or "").strip()
        if description:
            focus.extend(self._split_focus_text(description)[:3])
        required_skills = self._as_list(job_criteria.get("required_skills"))
        if required_skills:
            focus.append(f"核心技能要求：{'、'.join(str(item) for item in required_skills[:6])}")
        other_requirements = str(job_criteria.get("other_requirements") or "").strip()
        if other_requirements:
            focus.extend(self._split_focus_text(other_requirements)[:2])
        return self._dedupe_text_list(focus)[:6] or ["岗位未提供明确职责，按技能、经验、学历、项目和简历完整度综合判断"]

    def _split_focus_text(self, value: str) -> list[str]:
        lines = re.split(r"[\n。；;]", value)
        return [
            line.strip(" -•*、\t")
            for line in lines
            if 8 <= len(line.strip(" -•*、\t")) <= 120
        ]

    def _dimension_job_focus(self, dimension: str, job_criteria: dict, job_focus: list[str]) -> list[str]:
        required_skills = self._as_list(job_criteria.get("required_skills"))
        bonus_skills = self._as_list(job_criteria.get("bonus_skills"))
        min_experience = self._to_number(job_criteria.get("min_experience_years"))
        education = job_criteria.get("education")
        mapping = {
            "skill_match": [f"必备技能：{'、'.join(str(item) for item in required_skills[:6])}" if required_skills else "岗位未设置必备技能"],
            "experience_match": [f"最低工作年限：{min_experience:g} 年" if min_experience else "岗位未设置最低年限"],
            "education": [f"学历要求：{education}" if education else "岗位未设置学历硬性要求"],
            "project_relevance": [f"项目需体现：{'、'.join(str(item) for item in (required_skills + bonus_skills)[:6])}" if required_skills or bonus_skills else "项目需体现与岗位职责的直接关联"],
            "overall_quality": job_focus[:3],
        }
        return self._dedupe_text_list(mapping.get(dimension, job_focus[:3]))[:3]

    def _build_resume_evidence(self, resume_data: dict, keywords: list) -> list[str]:
        evidence: list[str] = []
        for exp in self._as_list(resume_data.get("work_experience"))[:3]:
            if isinstance(exp, dict):
                company = exp.get("company") or "未命名公司"
                position = exp.get("position") or "未注明岗位"
                description = str(exp.get("description") or "").strip()
                line = f"{company} / {position}"
                if description:
                    line = f"{line}：{description[:90]}"
                evidence.append(line)
        for project in self._as_list(resume_data.get("projects"))[:3]:
            if isinstance(project, dict):
                name = project.get("name") or "未命名项目"
                description = str(project.get("description") or "").strip()
                evidence.append(f"{name}：{description[:100]}" if description else str(name))
        if not evidence and keywords:
            evidence.append(f"简历技能与岗位关键词存在交集：{'、'.join(str(item) for item in keywords[:5])}")
        return self._dedupe_text_list(evidence)[:4]

    def _skill_evidence(self, matched_skills: list, bonus_skills_matched: list, resume_skills: list) -> list[str]:
        evidence = []
        if matched_skills:
            evidence.append(f"命中岗位必备技能：{'、'.join(str(skill) for skill in matched_skills[:6])}")
        if bonus_skills_matched:
            evidence.append(f"额外覆盖加分技能：{'、'.join(str(skill) for skill in bonus_skills_matched[:6])}")
        if resume_skills:
            evidence.append(f"简历技能池包含 {len(resume_skills)} 项技能，可继续按岗位核心技能深挖")
        return evidence or ["简历未提供明确技能清单，需通过面试或补充材料确认"]

    def _skill_concerns(self, missing_skills: list) -> list[str]:
        if missing_skills:
            return [f"岗位必备技能未明确体现：{'、'.join(str(skill) for skill in missing_skills[:6])}"]
        return ["技能清单匹配度较好，但仍需验证实际项目深度与独立交付能力"]

    def _experience_evidence(self, resume_data: dict, years_of_experience: float) -> list[str]:
        evidence = [f"系统估算候选人约 {years_of_experience:g} 年相关经验"]
        for exp in self._as_list(resume_data.get("work_experience"))[:2]:
            if isinstance(exp, dict):
                evidence.append(
                    f"{exp.get('company') or '未命名公司'}：{exp.get('position') or '岗位未注明'}，{str(exp.get('description') or '')[:80]}"
                )
        return self._dedupe_text_list(evidence)[:4]

    def _experience_concerns(self, years_of_experience: float, min_experience: float) -> list[str]:
        if min_experience and years_of_experience < min_experience:
            return [f"经验年限低于岗位要求：约 {years_of_experience:g} 年 / 要求 {min_experience:g} 年"]
        return ["年限满足或接近要求，需面试验证其最近岗位职责边界、团队规模和业务复杂度"]

    def _education_evidence(self, education_entries: list) -> list[str]:
        evidence = []
        for item in education_entries[:3]:
            if isinstance(item, dict):
                evidence.append(
                    " / ".join(str(part) for part in [item.get("school"), item.get("degree"), item.get("major")] if part)
                )
            elif item:
                evidence.append(str(item))
        return evidence or ["简历未提供明确教育经历"]

    def _education_concerns(self, required_education: Any, degree_match: bool) -> list[str]:
        if required_education and not degree_match:
            return [f"学历要求为 {required_education}，简历学历暂未明确满足"]
        return ["学历维度无明显阻塞，入职前按流程核验真实性即可"]

    def _project_evidence(self, projects: Any, fallback_evidence: list[str]) -> list[str]:
        evidence = []
        for project in self._as_list(projects)[:3]:
            if isinstance(project, dict):
                name = project.get("name") or "未命名项目"
                description = str(project.get("description") or "").strip()
                evidence.append(f"{name}：{description[:110]}" if description else str(name))
        return self._dedupe_text_list(evidence or fallback_evidence)[:4] or ["简历未提供可直接判断岗位相关性的项目"]

    def _project_concerns(self, project_score: int, relevant_projects: int) -> list[str]:
        if relevant_projects == 0:
            return ["尚未识别出与岗位关键词直接相关的项目，需要候选人补充代表项目"]
        if project_score < 75:
            return ["项目相关性存在一定基础，但个人贡献、技术难点和业务结果需要进一步追问"]
        return ["项目相关性较好，面试重点验证候选人的真实贡献比例和量化结果"]

    def _quality_evidence(self, resume_data: dict) -> list[str]:
        labels = []
        if resume_data.get("name"):
            labels.append("姓名")
        if resume_data.get("email") or resume_data.get("phone"):
            labels.append("联系方式")
        if resume_data.get("skills"):
            labels.append("技能")
        if resume_data.get("work_experience"):
            labels.append("工作经历")
        if resume_data.get("projects"):
            labels.append("项目经历")
        if resume_data.get("education"):
            labels.append("教育经历")
        return [f"简历已提供：{'、'.join(labels)}"] if labels else ["简历结构化信息不足"]

    def _quality_concerns(self, resume_data: dict) -> list[str]:
        concerns = []
        if not resume_data.get("email") and not resume_data.get("phone"):
            concerns.append("缺少联系方式，后续沟通存在阻塞")
        if not resume_data.get("projects"):
            concerns.append("缺少项目经历，较难判断岗位职责落地能力")
        if not concerns:
            concerns.append("简历信息较完整，但仍需核验项目指标、团队规模和个人贡献")
        return concerns

    def _dimension_questions(self, dimension: str, matched: list, missing: list) -> list[str]:
        examples = {
            "skill_match": [
                f"请结合最近一个项目说明你如何使用 {'、'.join(str(item) for item in matched[:3]) or '岗位核心技能'} 解决实际问题。",
                f"针对 {'、'.join(str(item) for item in missing[:3]) or '岗位关键技能'}，你的掌握程度和补齐计划是什么？",
            ],
            "experience_match": [
                "请说明最近一段工作中你负责的模块、团队规模、上下游协作方式和最终交付结果。",
                "你过往经验中与当前岗位职责最接近的一段是什么？为什么？",
            ],
            "education": [
                "你的教育背景中哪些课程、训练或研究经历与当前岗位最相关？",
                "是否有与岗位相关的证书、培训或持续学习记录可以补充？",
            ],
            "project_relevance": [
                "请选择一个最相关项目，拆解背景、技术方案、个人贡献、难点和量化结果。",
                "项目中哪些决策由你主导？如果重做一次会如何优化？",
            ],
            "overall_quality": [
                "请补充简历中最能证明岗位胜任力的一项成果及量化指标。",
                "简历中未展开的经历里，哪一段最值得我们深入了解？",
            ],
        }
        return examples.get(dimension, [])[:3]

    def _dimension_actions(self, dimension: str, score: int) -> list[str]:
        if score >= 80:
            prefix = "建议优先进入下一轮"
        elif score >= 65:
            prefix = "建议补充验证后再决定"
        else:
            prefix = "建议先补充材料或降低优先级"
        actions = {
            "skill_match": [f"{prefix}，技术面重点验证核心技能深度与真实项目使用场景"],
            "experience_match": [f"{prefix}，沟通中确认职责边界、管理/协作范围和业务复杂度"],
            "education": [f"{prefix}，按公司流程核验学历与专业背景"],
            "project_relevance": [f"{prefix}，要求候选人准备代表项目复盘"],
            "overall_quality": [f"{prefix}，要求补充量化成果、项目规模和联系方式等缺失信息"],
        }
        return actions.get(dimension, [prefix])

    def _build_local_recommendation_reason(
        self,
        skill_score: int,
        experience_score: int,
        project_score: int,
        matched_skills: list,
        missing_skills: list,
        job_criteria: dict,
    ) -> str:
        job_title = job_criteria.get("job_title") or "当前岗位"
        matched = f"已命中{'、'.join(str(skill) for skill in matched_skills[:4])}" if matched_skills else "核心技能命中较少"
        missing = f"主要风险是缺少{'、'.join(str(skill) for skill in missing_skills[:4])}" if missing_skills else "主要风险在于实际项目深度仍需面试验证"
        return (
            f"候选人与{job_title}的综合匹配需要结合技能、经验和项目三项判断："
            f"技能{skill_score}分、经验{experience_score}分、项目{project_score}分，{matched}；{missing}。"
        )

    def _build_recommendation_reason(self, normalized: dict, job_criteria: dict, resume_data: dict) -> str:
        existing = str(normalized.get("recommendation_reason") or "").strip()
        if existing:
            return existing
        fallback = self.build_local_analysis(job_criteria, resume_data)
        return fallback["recommendation_reason"]

    def _as_list(self, value: Any) -> list:
        if value is None:
            return []
        if isinstance(value, list):
            return [item for item in value if item not in (None, "")]
        if isinstance(value, tuple | set):
            return [item for item in value if item not in (None, "")]
        if value == "":
            return []
        return [value]

    def _flatten_text(self, value: Any) -> str:
        try:
            return json.dumps(value, ensure_ascii=False).lower()
        except TypeError:
            return str(value).lower()

    def _normalize(self, value: Any) -> str:
        return str(value or "").strip().lower()

    def _to_number(self, value: Any) -> float:
        if value in (None, ""):
            return 0.0
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    def _as_text_list(self, value: Any) -> list[str]:
        return [str(item) for item in self._as_list(value) if str(item).strip()]

    def _dedupe_text_list(self, values: list[str]) -> list[str]:
        seen = set()
        result = []
        for value in values:
            normalized = value.strip()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            result.append(normalized)
        return result

    def _term_matches(self, term: str, skills: list, text: str) -> bool:
        normalized_term = self._normalize(term)
        if not normalized_term:
            return False

        for skill in skills:
            normalized_skill = self._normalize(skill)
            if normalized_skill == normalized_term:
                return True
            if normalized_term in normalized_skill or normalized_skill in normalized_term:
                return True

        return normalized_term in text

    def _calculate_skill_score(
        self,
        required_skills: list,
        bonus_skills: list,
        matched_skills: list,
        bonus_skills_matched: list,
        resume_skills: list,
    ) -> int:
        if required_skills:
            required_ratio = len(matched_skills) / len(required_skills)
            bonus_ratio = len(bonus_skills_matched) / len(bonus_skills) if bonus_skills else 0
            return self._clamp_score(30 + required_ratio * 60 + bonus_ratio * 10)

        if resume_skills:
            bonus_ratio = len(bonus_skills_matched) / len(bonus_skills) if bonus_skills else 0
            return self._clamp_score(75 + bonus_ratio * 15)

        return 55

    def _estimate_years_of_experience(self, resume_data: dict) -> float:
        explicit_years = resume_data.get("years_of_experience")
        if explicit_years not in (None, ""):
            years = self._to_number(explicit_years)
            if 0 < years < 80:
                return years

        experience_entries = self._as_list(resume_data.get("work_experience"))
        years_from_dates = self._estimate_years_from_experience_dates(experience_entries)
        if years_from_dates > 0:
            return years_from_dates

        text = self._flatten_text(resume_data.get("work_experience", []))
        patterns = [
            r"(\d+(?:\.\d+)?)\s*(?:年|years?|yrs?)\s*(?:以上)?\s*(?:工作|从业|开发|管理)?经验",
            r"(?:工作|从业|开发|管理)?经验\s*(?:约|超过|>=|≥|大于)?\s*(\d+(?:\.\d+)?)\s*(?:年|years?|yrs?)",
            r"(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b",
        ]
        matches: list[str] = []
        for pattern in patterns:
            matches.extend(re.findall(pattern, text, flags=re.IGNORECASE))
        if matches:
            plausible = [self._to_number(match) for match in matches if 0 < self._to_number(match) < 80]
            if plausible:
                return max(plausible)

        return float(len(experience_entries) * 2)

    def _estimate_years_from_experience_dates(self, experience_entries: list) -> float:
        intervals: list[tuple[int, int]] = []

        for entry in experience_entries:
            if not isinstance(entry, dict):
                continue

            start = self._parse_year_month(entry.get("start_date"))
            end = self._parse_year_month(entry.get("end_date"), allow_present=True)
            if not start or not end:
                continue

            start_month = start[0] * 12 + start[1]
            end_month = end[0] * 12 + end[1]
            if end_month < start_month:
                continue

            intervals.append((start_month, end_month))

        if not intervals:
            return 0.0

        intervals.sort()
        merged: list[list[int]] = []
        for start, end in intervals:
            if not merged or start > merged[-1][1] + 1:
                merged.append([start, end])
            else:
                merged[-1][1] = max(merged[-1][1], end)

        total_months = sum(end - start + 1 for start, end in merged)
        return round(total_months / 12, 1)

    def _parse_year_month(self, value: Any, allow_present: bool = False) -> tuple[int, int] | None:
        text = str(value or "").strip()
        if not text:
            return None

        if allow_present and re.search(r"至今|现在|present|current", text, flags=re.IGNORECASE):
            today = date.today()
            return today.year, today.month

        match = re.search(r"(19|20)\d{2}\s*(?:年|[./-])?\s*(\d{1,2})?", text)
        if not match:
            return None

        year = int(match.group(0)[:4])
        month_match = re.search(r"(?:19|20)\d{2}\s*(?:年|[./-])\s*(\d{1,2})", text)
        month = int(month_match.group(1)) if month_match else 1
        if month < 1 or month > 12:
            month = 1
        return year, month

    def _calculate_experience_score(self, years_of_experience: float, min_experience: float) -> int:
        if min_experience <= 0:
            return 82 if years_of_experience > 0 else 65

        if years_of_experience >= min_experience:
            extra_years = min(years_of_experience - min_experience, 4)
            return self._clamp_score(78 + extra_years * 4)

        if years_of_experience == 0:
            return 35

        return self._clamp_score(45 + (years_of_experience / min_experience) * 30)

    def _education_rank(self, value: Any) -> int:
        text = self._normalize(value)
        if any(token in text for token in ["phd", "doctor", "博士"]):
            return 4
        if any(token in text for token in ["master", "硕士", "研究生"]):
            return 3
        if any(token in text for token in ["bachelor", "本科", "学士"]):
            return 2
        if any(token in text for token in ["associate", "college", "大专", "专科"]):
            return 1
        return 0

    def _calculate_education_score(self, required_education: Any, education_entries: list) -> tuple[int, bool]:
        required_rank = self._education_rank(required_education)
        resume_rank = 0

        for entry in education_entries:
            if isinstance(entry, dict):
                resume_rank = max(
                    resume_rank,
                    self._education_rank(f"{entry.get('degree', '')} {entry.get('major', '')}"),
                )
            else:
                resume_rank = max(resume_rank, self._education_rank(entry))

        if required_rank == 0:
            return (82 if resume_rank else 65), True

        degree_match = resume_rank >= required_rank
        if degree_match:
            return self._clamp_score(84 + min(resume_rank - required_rank, 2) * 5), True

        if resume_rank == 0:
            return 40, False

        return self._clamp_score(45 + (resume_rank / required_rank) * 30), False

    def _count_relevant_projects(self, projects: Any, keywords: list, resume_skill_text: str) -> int:
        project_entries = self._as_list(projects)
        normalized_keywords = [self._normalize(keyword) for keyword in keywords if self._normalize(keyword)]
        if not normalized_keywords:
            return len(project_entries)

        count = 0
        for project in project_entries:
            project_text = f"{self._flatten_text(project)} {resume_skill_text}"
            if any(keyword in project_text for keyword in normalized_keywords):
                count += 1
        return count

    def _calculate_project_score(self, projects: Any, relevant_projects: int, keywords: list) -> int:
        project_entries = self._as_list(projects)
        if not project_entries:
            return 45 if keywords else 60

        if not keywords:
            return 78

        relevance_ratio = relevant_projects / len(project_entries)
        return self._clamp_score(50 + relevance_ratio * 35 + min(relevant_projects, 2) * 5)

    def _calculate_resume_quality_score(self, resume_data: dict) -> int:
        fields = [
            resume_data.get("name"),
            resume_data.get("email"),
            resume_data.get("phone"),
            resume_data.get("skills"),
            resume_data.get("education"),
            resume_data.get("work_experience"),
            resume_data.get("projects"),
        ]
        completed_fields = sum(1 for field in fields if bool(field))
        return self._clamp_score(45 + (completed_fields / len(fields)) * 50)

    def _build_strengths(
        self,
        skill_score: int,
        experience_score: int,
        education_score: int,
        project_score: int,
        matched_skills: list,
        bonus_skills_matched: list,
        years_of_experience: float,
        min_experience: float,
        degree_match: bool,
    ) -> list[str]:
        strengths = []
        if matched_skills:
            strengths.append(f"已匹配核心技能：{', '.join(str(skill) for skill in matched_skills[:5])}")
        if bonus_skills_matched:
            strengths.append(f"覆盖加分技能：{', '.join(str(skill) for skill in bonus_skills_matched[:5])}")
        if min_experience and years_of_experience >= min_experience:
            strengths.append(f"工作年限达到要求，预计约{years_of_experience:g}年经验")
        if degree_match and education_score >= 80:
            strengths.append("学历背景满足岗位要求")
        if project_score >= 80:
            strengths.append("项目经历与岗位需求相关度较高")
        if skill_score >= 80 and experience_score >= 75:
            strengths.append("技能与经验两个核心维度表现稳定")

        return strengths or ["简历已提供基础信息，可用于初步评估"]

    def _build_weaknesses(
        self,
        missing_skills: list,
        experience_score: int,
        education_score: int,
        project_score: int,
        years_of_experience: float,
        min_experience: float,
        resume_data: dict,
    ) -> list[str]:
        weaknesses = []
        if missing_skills:
            weaknesses.append(f"缺少岗位要求技能：{', '.join(str(skill) for skill in missing_skills[:5])}")
        if min_experience and years_of_experience < min_experience:
            weaknesses.append(f"工作年限低于岗位要求，当前预计约{years_of_experience:g}年")
        if education_score < 70:
            weaknesses.append("学历信息与岗位要求的匹配度偏低或信息不足")
        if project_score < 70:
            weaknesses.append("项目经历与岗位关键词的直接关联不足")
        if not resume_data.get("email") or not resume_data.get("phone"):
            weaknesses.append("联系方式信息不完整")

        return weaknesses or ["未发现明显短板，可结合面试进一步验证"]

    def _skill_analysis_text(
        self,
        score: int,
        matched_skills: list,
        missing_skills: list,
        bonus_skills_matched: list,
    ) -> str:
        matched = "、".join(str(skill) for skill in matched_skills) or "暂无明确匹配"
        missing = "、".join(str(skill) for skill in missing_skills) or "无明显缺口"
        bonus = "、".join(str(skill) for skill in bonus_skills_matched) or "暂无"
        return f"本地分析评分{score}分。匹配技能：{matched}；缺失技能：{missing}；加分技能：{bonus}。"

    def _experience_analysis_text(self, score: int, years_of_experience: float, min_experience: float) -> str:
        requirement = f"岗位要求{min_experience:g}年" if min_experience else "岗位未设置最低年限"
        return f"本地分析评分{score}分。简历预计约{years_of_experience:g}年经验，{requirement}。"

    def _education_analysis_text(
        self,
        score: int,
        required_education: Any,
        education_entries: list,
        degree_match: bool,
    ) -> str:
        requirement = required_education or "未设置学历要求"
        status = "满足" if degree_match else "暂未明确满足"
        education_count = len(education_entries)
        return f"本地分析评分{score}分。岗位学历要求为{requirement}，简历提供{education_count}条教育经历，判断为{status}。"

    def _project_analysis_text(self, score: int, relevant_projects: int) -> str:
        return f"本地分析评分{score}分。根据岗位关键词匹配到{relevant_projects}个相关项目。"

    def _quality_analysis_text(self, score: int) -> str:
        return f"本地分析评分{score}分。该分数基于姓名、联系方式、技能、教育、工作和项目等简历信息完整度计算。"

    def _clamp_score(self, value: float) -> int:
        return max(0, min(100, round(value)))

    def calculate_recommendation_level(
        self,
        overall_score: float,
        rank: int,
        total_resumes: int
    ) -> str:
        """
        Calculate recommendation level based on score and ranking.

        - High-scoring top 10% candidates: strongly_recommended
        - Qualified top 30% candidates: recommended
        - Rest: pending
        """
        if total_resumes == 0:
            return "pending"

        top_10_cutoff = max(1, math.ceil(total_resumes * 0.1))
        top_30_cutoff = max(1, math.ceil(total_resumes * 0.3))

        if overall_score >= 85 and rank <= top_10_cutoff:
            return "strongly_recommended"
        elif overall_score >= 70 and rank <= top_30_cutoff:
            return "recommended"
        else:
            return "pending"
