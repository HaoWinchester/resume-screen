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
        weights = job_criteria.get("weights", {})

        resume_skills = resume_data.get("skills", [])
        resume_education = resume_data.get("education", [])
        resume_experience = resume_data.get("work_experience", [])
        resume_projects = resume_data.get("projects", [])

        prompt = f"""你是一位专业的人力资源分析师，负责评估候选人与岗位要求的匹配度。

请仔细阅读以下岗位要求和候选人简历，给出专业的分析评估。

## 岗位要求

**必需技能**: {', '.join(required_skills) if required_skills else '无'}
**加分技能**: {', '.join(bonus_skills) if bonus_skills else '无'}
**最低工作年限**: {min_experience} 年
**学历要求**: {education_level if education_level else '无'}
**偏好行业**: {', '.join(industry_pref) if industry_pref else '无'}

**评分权重**:
- 技能匹配度 (skill_match): {weights.get('skill_match', 'medium')}
- 经验匹配度 (experience_match): {weights.get('experience_match', 'medium')}
- 教育背景 (education): {weights.get('education', 'medium')}
- 项目相关性 (project_relevance): {weights.get('project_relevance', 'medium')}
- 整体质量 (overall_quality): {weights.get('overall_quality', 'medium')}

## 候选人简历

**姓名**: {resume_data.get('name', '未知')}
**邮箱**: {resume_data.get('email', '未知')}

**技能**: {', '.join(resume_skills) if resume_skills else '无'}

**教育背景**:
{self._format_education(resume_education)}

**工作经验**:
{self._format_experience(resume_experience)}

**项目经历**:
{self._format_projects(resume_projects)}

## 分析要求

请按照以下维度进行评估（每个维度0-100分）：

1. **技能匹配度 (skill_match)**: 评估候选人掌握的技能与岗位必需技能和加分技能的匹配程度
2. **经验匹配度 (experience_match)**: 评估候选人的工作经验年限和相关经验与岗位要求的匹配度
3. **教育背景 (education)**: 评估候选人的学历和专业背景与岗位要求的匹配度
4. **项目相关性 (project_relevance)**: 评估候选人项目经验与岗位需求的相关性
5. **整体质量 (overall_quality)**: 评估简历的整体质量、完整性和专业度

请严格按照以下JSON格式返回分析结果：

```json
{{
  "skill_match": {{
    "score": 85,
    "analysis": "候选人掌握了大部分必需技能...",
    "matched_skills": ["React", "TypeScript"],
    "missing_skills": ["Node.js"],
    "bonus_skills_matched": ["Docker"]
  }},
  "experience_match": {{
    "score": 75,
    "analysis": "候选人有5年工作经验...",
    "years_of_experience": 5,
    "relevant_years": 3
  }},
  "education": {{
    "score": 80,
    "analysis": "候选人有本科学历...",
    "degree_match": true
  }},
  "project_relevance": {{
    "score": 90,
    "analysis": "候选人参与的项目与岗位高度相关...",
    "relevant_projects": 2
  }},
  "overall_quality": {{
    "score": 85,
    "analysis": "简历结构清晰，内容完整..."
  }},
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
            result.append(f"- {edu.get('school', '未知学校')}: {edu.get('degree', '未知学历')} {edu.get('major', '')}")
        return "\n".join(result)

    def _format_experience(self, experience: list) -> str:
        if not experience:
            return "无"

        result = []
        for exp in experience[:3]:  # Limit to 3 entries
            result.append(f"- {exp.get('company', '未知公司')}: {exp.get('position', '未知职位')}")
        return "\n".join(result)

    def _format_projects(self, projects: list) -> str:
        if not projects:
            return "无"

        result = []
        for proj in projects[:3]:  # Limit to 3 entries
            result.append(f"- {proj.get('name', '未知项目')}: {proj.get('description', '')[:50]}...")
        return "\n".join(result)

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
            },
            "experience_match": {
                "score": experience_score,
                "analysis": self._experience_analysis_text(experience_score, years_of_experience, min_experience),
                "years_of_experience": years_of_experience,
                "relevant_years": min(years_of_experience, min_experience) if min_experience else years_of_experience,
            },
            "education": {
                "score": education_score,
                "analysis": self._education_analysis_text(education_score, required_education, education_entries, degree_match),
                "degree_match": degree_match,
            },
            "project_relevance": {
                "score": project_score,
                "analysis": self._project_analysis_text(project_score, relevant_projects),
                "relevant_projects": relevant_projects,
            },
            "overall_quality": {
                "score": overall_quality_score,
                "analysis": self._quality_analysis_text(overall_quality_score),
            },
            "strengths": strengths,
            "weaknesses": weaknesses,
        }

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
