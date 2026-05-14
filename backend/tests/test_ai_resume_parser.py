"""Tests for AI-assisted resume structuring."""

import json

import pytest

from app.services.ai_resume_parser import AIResumeParser


def test_parse_json_response_accepts_markdown_block():
    parser = AIResumeParser()
    payload = {"name": "孟浩", "skills": ["Python", "React"]}

    result = parser.parse_json_response(f"```json\n{json.dumps(payload, ensure_ascii=False)}\n```")

    assert result == payload


def test_normalize_ai_result_preserves_raw_text_and_fills_ai_fields():
    parser = AIResumeParser()
    fallback = {
        "name": None,
        "email": "fallback@example.com",
        "skills": ["Python"],
        "education": [],
        "work_experience": [],
        "projects": [],
        "raw_text": "姓名：孟浩",
        "text_extractor": "pdftotext -layout",
    }
    ai_result = {
        "name": "孟浩",
        "email": None,
        "current_title": "AI 产品经理",
        "target_position": "AI 产品负责人",
        "location": "上海",
        "expected_salary": "面议",
        "availability": "两周内",
        "years_of_experience": 10,
        "summary": "10 年 AI 产品与项目经验。",
        "skills": ["Python", "Python", "RAG"],
        "education": [{"school": "安徽工程大学", "degree": "本科", "major": "软件工程"}],
        "work_experience": [
            {
                "company": "上海幻谱信息科技有限公司",
                "position": "AI 产品经理",
                "responsibilities": ["负责多 Agent 产品规划"],
                "achievements": ["完成企业级方案落地"],
                "technologies": ["RAG", "Agent"],
            }
        ],
        "certificates": [{"name": "PMP", "issuer": "PMI", "date": "2020"}],
        "languages": [{"name": "英语", "level": "CET-6"}],
        "awards": ["优秀项目奖", "优秀项目奖"],
        "self_evaluation": "擅长 AI 产品落地。",
    }

    result = parser.normalize_ai_result(ai_result, fallback)

    assert result["name"] == "孟浩"
    assert result["email"] == "fallback@example.com"
    assert result["current_title"] == "AI 产品经理"
    assert result["target_position"] == "AI 产品负责人"
    assert result["location"] == "上海"
    assert result["expected_salary"] == "面议"
    assert result["availability"] == "两周内"
    assert result["years_of_experience"] == 10
    assert result["summary"] == "10 年 AI 产品与项目经验。"
    assert result["skills"] == ["Python", "RAG"]
    assert result["education"][0]["school"] == "安徽工程大学"
    assert result["work_experience"][0]["responsibilities"] == ["负责多 Agent 产品规划"]
    assert result["certificates"][0]["name"] == "PMP"
    assert result["languages"][0]["level"] == "CET-6"
    assert result["awards"] == ["优秀项目奖"]
    assert result["self_evaluation"] == "擅长 AI 产品落地。"
    assert result["raw_text"] == "姓名：孟浩"
    assert result["text_extractor"] == "pdftotext -layout"


def test_build_prompt_requests_complete_resume_fields():
    parser = AIResumeParser()

    prompt = parser._build_prompt("姓名：孟浩\n项目经历：多 Agent 招聘自动化")

    assert "主数据源" in prompt
    assert "certificates" in prompt
    assert "languages" in prompt
    assert "responsibilities" in prompt
    assert "achievements" in prompt
    assert "technologies" in prompt
    assert "多 Agent 招聘自动化" in prompt


def test_normalize_ai_result_forces_summary_when_provider_omits_it():
    parser = AIResumeParser()
    fallback = {
        "name": "孟浩",
        "email": None,
        "skills": ["Python", "RAG", "Dify", "FastAPI"],
        "education": [],
        "work_experience": [
            {
                "company": "上海幻谱信息科技有限公司",
                "position": "技术总监",
                "description": "负责公司战略规划、核心产品研发与团队建设。",
            }
        ],
        "projects": [{"name": "清源系统", "description": "AI 内容安全检测平台"}],
        "raw_text": "姓名：孟浩\n技术能力：Python、RAG、Dify、FastAPI",
        "text_extractor": "pdftotext -layout",
    }
    ai_result = {
        "name": "孟浩",
        "years_of_experience": 10,
        "skills": ["Python", "RAG", "Dify", "FastAPI"],
    }

    result = parser.normalize_ai_result(ai_result, fallback)

    assert result["summary"]
    assert "10年经验" in result["summary"]
    assert "Python" in result["summary"]
    assert "清源系统" in result["summary"]


def test_normalize_ai_result_accepts_summary_aliases():
    parser = AIResumeParser()
    fallback = {
        "name": "李四",
        "skills": [],
        "education": [],
        "work_experience": [],
        "projects": [],
        "raw_text": "姓名：李四",
        "text_extractor": "pdftotext -layout",
    }
    ai_result = {"简历摘要": "5 年前端开发经验，熟悉 React 与工程化建设。"}

    result = parser.normalize_ai_result(ai_result, fallback)

    assert result["summary"] == "5 年前端开发经验，熟悉 React 与工程化建设。"


@pytest.mark.asyncio
async def test_parse_local_fallback_also_forces_summary():
    parser = AIResumeParser()
    parser.settings.AI_RESUME_PARSER_PROVIDER = "local"
    fallback = {
        "name": "王五",
        "years_of_experience": 6,
        "skills": ["Java", "Spring", "Redis"],
        "education": [],
        "work_experience": [{"company": "示例科技", "position": "后端工程师"}],
        "projects": [],
        "raw_text": "王五，6 年 Java 后端经验。",
        "text_extractor": "pdftotext -layout",
    }

    result = await parser.parse(fallback["raw_text"], fallback)

    assert result["summary"]
    assert "6年经验" in result["summary"]
    assert "Java" in result["summary"]
