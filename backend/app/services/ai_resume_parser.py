import json
import re
from typing import Any

from anthropic import Anthropic
from openai import OpenAI

from app.config import get_settings


class AIResumeParser:
    """Use configured LLM providers to structure resume text after CLI extraction."""

    def __init__(self):
        self.settings = get_settings()
        self.anthropic_client = Anthropic(api_key=self.settings.ANTHROPIC_API_KEY) if self.settings.ANTHROPIC_API_KEY else None
        self.openai_client = OpenAI(api_key=self.settings.OPENAI_API_KEY) if self.settings.OPENAI_API_KEY else None
        self.zhipu_client = (
            OpenAI(api_key=self.settings.ZHIPU_API_KEY, base_url=self.settings.ZHIPU_BASE_URL)
            if self.settings.ZHIPU_API_KEY
            else None
        )

    async def parse(self, raw_text: str, fallback_data: dict[str, Any]) -> dict[str, Any]:
        """Return AI-structured resume data, preserving local fallback fields."""
        if not raw_text.strip():
            return self._ensure_required_summary(fallback_data)

        provider_order = self._resolve_provider_order()
        prompt = self._build_prompt(raw_text)
        errors: list[str] = []

        for provider in provider_order:
            if provider == "local":
                return self._ensure_required_summary(fallback_data)
            if not self._provider_configured(provider):
                errors.append(f"{provider}=not configured")
                continue

            try:
                ai_result = await self._call_provider(provider, prompt)
                merged = self.normalize_ai_result(ai_result, fallback_data)
                merged["structured_by"] = f"ai:{provider}"
                return merged
            except Exception as exc:
                errors.append(f"{provider}={exc}")

        fallback = dict(fallback_data)
        fallback["structured_by"] = "local"
        if errors:
            fallback["ai_parse_error"] = "; ".join(errors[:3])
        return self._ensure_required_summary(fallback)

    def _resolve_provider_order(self) -> list[str]:
        provider = self.settings.AI_RESUME_PARSER_PROVIDER.strip().lower()
        available = {"anthropic", "openai", "zhipu", "local"}
        if provider in available:
            return [provider]

        configured_order = [
            item.strip().lower()
            for item in self.settings.AI_RESUME_PARSER_PROVIDER_ORDER.split(",")
            if item.strip().lower() in available
        ]
        return configured_order or ["zhipu", "openai", "anthropic"]

    def _provider_configured(self, provider: str) -> bool:
        if provider == "anthropic":
            return self.anthropic_client is not None
        if provider == "openai":
            return self.openai_client is not None
        if provider == "zhipu":
            return self.zhipu_client is not None
        return provider == "local"

    def _build_prompt(self, raw_text: str) -> str:
        clipped_text = raw_text[:18000]
        return f"""你是专业 HR 简历解析助手。请把下面的简历原文作为主数据源，尽可能完整地抽取结构化信息；本地正则结果可能不完整，所以你需要从原文中补齐经历、项目、证书、语言、奖项、求职意向等信息。

如果原文没有明确给出某个字段，请返回 null 或空数组。请只输出 JSON，不要输出解释、Markdown 或代码块。
注意："summary" 是必填字段，不能为 null、空字符串或省略。summary 必须用中文基于原文概括候选人的年限、当前/核心岗位、核心技能、代表经历或项目亮点，控制在 60-140 个中文字符；如果原文没有单独的自我评价，也要根据已抽取的经历、技能和项目生成事实性摘要，不允许编造原文没有的公司、岗位、学历、证书或成果。
请保留原文中的中文、英文技术词和专有名词，不要把技能名翻译错。日期可保留原文格式。工作经历和项目经历的 description 要包含职责、成果、指标和技术栈等关键信息；如果原文有多条职责/成果，请同时填入 responsibilities、achievements 或 technologies。

JSON 结构必须是：
{{
  "name": string | null,
  "gender": string | null,
  "age": number | string | null,
  "email": string | null,
  "phone": string | null,
  "current_title": string | null,
  "target_position": string | null,
  "location": string | null,
  "expected_salary": string | null,
  "availability": string | null,
  "years_of_experience": number | null,
  "summary": string,
  "education": [
    {{"school": string | null, "degree": string | null, "major": string | null, "start_date": string | null, "end_date": string | null, "description": string | null}}
  ],
  "work_experience": [
    {{"company": string | null, "position": string | null, "department": string | null, "start_date": string | null, "end_date": string | null, "description": string | null, "responsibilities": [string], "achievements": [string], "technologies": [string]}}
  ],
  "projects": [
    {{"name": string | null, "role": string | null, "start_date": string | null, "end_date": string | null, "description": string | null, "responsibilities": [string], "achievements": [string], "technologies": [string]}}
  ],
  "skills": [string],
  "certificates": [
    {{"name": string | null, "issuer": string | null, "date": string | null}}
  ],
  "languages": [
    {{"name": string | null, "level": string | null}}
  ],
  "awards": [string],
  "self_evaluation": string | null
}}

简历原文：
{clipped_text}
"""

    async def _call_provider(self, provider: str, prompt: str) -> dict[str, Any]:
        if provider == "anthropic":
            return await self._call_anthropic(prompt)
        if provider == "openai":
            return await self._call_openai(prompt)
        if provider == "zhipu":
            return await self._call_zhipu(prompt)
        raise ValueError(f"Unknown AI resume parser provider: {provider}")

    async def _call_anthropic(self, prompt: str) -> dict[str, Any]:
        if not self.anthropic_client:
            raise ValueError("Anthropic API not configured")

        message = self.anthropic_client.messages.create(
            model=self.settings.ANTHROPIC_RESUME_PARSER_MODEL,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        content = message.content[0].text
        return self.parse_json_response(content)

    async def _call_openai(self, prompt: str) -> dict[str, Any]:
        if not self.openai_client:
            raise ValueError("OpenAI API not configured")

        response = self.openai_client.chat.completions.create(
            model=self.settings.OPENAI_RESUME_PARSER_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=4096,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or "{}"
        return self.parse_json_response(content)

    async def _call_zhipu(self, prompt: str) -> dict[str, Any]:
        if not self.zhipu_client:
            raise ValueError("Zhipu API not configured")

        response = self.zhipu_client.chat.completions.create(
            model=self.settings.ZHIPU_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=4096,
        )
        content = response.choices[0].message.content or "{}"
        return self.parse_json_response(content)

    def parse_json_response(self, content: str) -> dict[str, Any]:
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        try:
            value = json.loads(content)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", content, flags=re.S)
            if not match:
                raise
            value = json.loads(match.group(0))

        if not isinstance(value, dict):
            raise ValueError("AI resume parser did not return a JSON object")
        return value

    def normalize_ai_result(self, ai_result: dict[str, Any], fallback_data: dict[str, Any]) -> dict[str, Any]:
        result = dict(fallback_data)
        for key in (
            "name",
            "gender",
            "age",
            "email",
            "phone",
            "current_title",
            "target_position",
            "location",
            "expected_salary",
            "availability",
            "years_of_experience",
            "self_evaluation",
        ):
            value = ai_result.get(key)
            if value not in (None, "", []):
                result[key] = value

        summary = self._first_text_value(
            ai_result,
            "summary",
            "resume_summary",
            "professional_summary",
            "profile_summary",
            "个人摘要",
            "简历摘要",
            "候选人摘要",
            "自我评价",
            "个人评价",
        )
        if summary:
            result["summary"] = self._clean_summary(summary)

        for key in ("education", "work_experience", "projects", "certificates", "languages"):
            value = ai_result.get(key)
            if isinstance(value, list) and value:
                cleaned_items = [
                    item
                    for item in value
                    if isinstance(item, dict) and any(field not in (None, "", []) for field in item.values())
                ]
                if cleaned_items:
                    result[key] = cleaned_items

        for key in ("skills", "awards"):
            values = ai_result.get(key)
            if isinstance(values, list) and values:
                result[key] = self._dedupe_text_list(values)

        result["raw_text"] = fallback_data.get("raw_text")
        result["text_extractor"] = fallback_data.get("text_extractor")
        if not result.get("summary"):
            result["summary"] = self._build_required_summary(result)
        return result

    def _ensure_required_summary(self, data: dict[str, Any]) -> dict[str, Any]:
        result = dict(data)
        if not result.get("summary"):
            result["summary"] = self._build_required_summary(result)
        return result

    def _first_text_value(self, source: dict[str, Any], *keys: str) -> str | None:
        for key in keys:
            value = source.get(key)
            if value not in (None, "", []):
                return str(value)
        return None

    def _clean_summary(self, value: str) -> str:
        summary = re.sub(r"\s+", " ", str(value)).strip(" ：:;；,，")
        if len(summary) > 180:
            summary = summary[:177].rstrip(" ，,；;") + "..."
        return summary

    def _build_required_summary(self, data: dict[str, Any]) -> str:
        name = str(data.get("name") or "候选人").strip()
        years = data.get("years_of_experience")
        years_text = f"{years}年经验" if years not in (None, "", []) else "具备相关经验"
        title = str(data.get("current_title") or "").strip()

        work_experience = data.get("work_experience") if isinstance(data.get("work_experience"), list) else []
        latest_work = next((item for item in work_experience if isinstance(item, dict)), {})
        if not title and latest_work:
            title = str(latest_work.get("position") or "").strip()

        skills = self._dedupe_text_list(data.get("skills") or [])[:8] if isinstance(data.get("skills"), list) else []
        skill_text = "，".join(skills) if skills else "岗位相关技能"

        projects = data.get("projects") if isinstance(data.get("projects"), list) else []
        first_project = next((item for item in projects if isinstance(item, dict) and item.get("name")), None)
        project_text = f"，代表项目包括{first_project.get('name')}" if first_project else ""

        company = str(latest_work.get("company") or "").strip() if latest_work else ""
        company_text = f"，曾任职于{company}" if company else ""
        title_text = f"，核心方向为{title}" if title else ""

        return self._clean_summary(
            f"{name}拥有{years_text}{title_text}，掌握{skill_text}{company_text}{project_text}，可作为重点候选人进一步评估。"
        )

    def _dedupe_text_list(self, values: list[Any]) -> list[str]:
        seen: set[str] = set()
        result: list[str] = []
        for value in values:
            text = str(value).strip()
            if not text or text in seen:
                continue
            seen.add(text)
            result.append(text)
        return result
