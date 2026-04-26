"""Tests for the AIAnalyzer service."""

import json

import pytest

from app.services.ai_analyzer import AIAnalyzer


# ---------------------------------------------------------------------------
# build_analysis_prompt
# ---------------------------------------------------------------------------

class TestBuildAnalysisPrompt:
    def test_build_analysis_prompt(self):
        analyzer = AIAnalyzer()
        job_criteria = {
            "required_skills": ["Python", "React"],
            "bonus_skills": ["Docker"],
            "min_experience_years": 3,
            "education": "bachelor",
            "industry_preference": ["Technology"],
            "weights": {
                "skill_match": "high",
                "experience_match": "medium",
                "education": "low",
                "project_relevance": "medium",
                "overall_quality": "low",
            },
        }
        resume_data = {
            "name": "张三",
            "email": "zhangsan@example.com",
            "skills": ["Python", "Docker", "React"],
            "education": [{"school": "清华大学", "degree": "硕士", "major": "CS"}],
            "work_experience": [{"company": "ABC", "position": "Dev"}],
            "projects": [{"name": "Web App", "description": "Built a web app"}],
        }
        prompt = analyzer.build_analysis_prompt(job_criteria, resume_data)
        assert "Python" in prompt
        assert "React" in prompt
        assert "张三" in prompt
        assert "skill_match" in prompt
        assert "experience_match" in prompt
        assert "education" in prompt
        assert "project_relevance" in prompt
        assert "overall_quality" in prompt
        assert "high" in prompt
        assert "3" in prompt


# ---------------------------------------------------------------------------
# calculate_overall_score
# ---------------------------------------------------------------------------

class TestCalculateOverallScore:
    def test_calculate_overall_score_weighted(self):
        analyzer = AIAnalyzer()
        dimension_scores = {
            "skill_match": {"score": 90},
            "experience_match": {"score": 80},
            "education": {"score": 70},
            "project_relevance": {"score": 60},
            "overall_quality": {"score": 85},
        }
        weights = {
            "skill_match": "high",       # 3
            "experience_match": "medium", # 2
            "education": "low",          # 1
            "project_relevance": "medium", # 2
            "overall_quality": "low",    # 1
        }
        # (90*3 + 80*2 + 70*1 + 60*2 + 85*1) / (3+2+1+2+1) = 705 / 9 = 78.33
        result = analyzer.calculate_overall_score(dimension_scores, weights)
        assert result == round(705 / 9, 2)

    def test_calculate_score_all_high_weights(self):
        analyzer = AIAnalyzer()
        dimension_scores = {
            "skill_match": {"score": 100},
            "experience_match": {"score": 80},
        }
        weights = {
            "skill_match": "high",
            "experience_match": "high",
        }
        # (100*3 + 80*3) / 6 = 540 / 6 = 90.0
        result = analyzer.calculate_overall_score(dimension_scores, weights)
        assert result == 90.0

    def test_calculate_score_mixed_weights(self):
        analyzer = AIAnalyzer()
        dimension_scores = {
            "skill_match": {"score": 50},
            "experience_match": {"score": 100},
            "education": {"score": 0},
        }
        weights = {
            "skill_match": "low",    # 1
            "experience_match": "medium",  # 2
            "education": "high",    # 3
        }
        # (50*1 + 100*2 + 0*3) / (1+2+3) = 250 / 6 = 41.67
        result = analyzer.calculate_overall_score(dimension_scores, weights)
        assert result == round(250 / 6, 2)

    def test_calculate_score_empty(self):
        analyzer = AIAnalyzer()
        result = analyzer.calculate_overall_score({}, {})
        assert result == 0.0


# ---------------------------------------------------------------------------
# calculate_recommendation_level
# ---------------------------------------------------------------------------

class TestRecommendationLevel:
    def test_recommendation_level_strongly_recommended(self):
        analyzer = AIAnalyzer()
        # rank=1, total=10 -> 1/10=0.1 <= 0.1 -> top 10%
        result = analyzer.calculate_recommendation_level(95.0, 1, 10)
        assert result == "strongly_recommended"

    def test_recommendation_level_recommended(self):
        analyzer = AIAnalyzer()
        # rank=2, total=10 -> 2/10=0.2, > 0.1 but <= 0.3
        result = analyzer.calculate_recommendation_level(85.0, 2, 10)
        assert result == "recommended"

    def test_recommendation_level_pending(self):
        analyzer = AIAnalyzer()
        # rank=5, total=10 -> 5/10=0.5 > 0.3
        result = analyzer.calculate_recommendation_level(60.0, 5, 10)
        assert result == "pending"

    def test_recommendation_level_zero_total(self):
        analyzer = AIAnalyzer()
        result = analyzer.calculate_recommendation_level(90.0, 0, 0)
        assert result == "pending"

    def test_recommendation_level_single_high_score_candidate(self):
        analyzer = AIAnalyzer()
        result = analyzer.calculate_recommendation_level(90.0, 1, 1)
        assert result == "strongly_recommended"

    def test_recommendation_level_single_low_score_candidate(self):
        analyzer = AIAnalyzer()
        result = analyzer.calculate_recommendation_level(60.0, 1, 1)
        assert result == "pending"


# ---------------------------------------------------------------------------
# parse_ai_response
# ---------------------------------------------------------------------------

class TestParseAIResponse:
    def test_parse_ai_response_valid_json(self):
        analyzer = AIAnalyzer()
        raw = '{"skill_match": {"score": 90}, "strengths": ["good"]}'
        result = analyzer.parse_ai_response(raw)
        assert result["skill_match"]["score"] == 90
        assert result["strengths"] == ["good"]

    def test_parse_ai_response_invalid_json(self):
        analyzer = AIAnalyzer()
        with pytest.raises(ValueError, match="Failed to parse AI response"):
            analyzer.parse_ai_response("this is not json at all")

    def test_parse_ai_response_with_markdown_blocks(self):
        analyzer = AIAnalyzer()
        raw = '''```json
{
    "skill_match": {"score": 85},
    "weaknesses": ["none"]
}
```'''
        result = analyzer.parse_ai_response(raw)
        assert result["skill_match"]["score"] == 85
        assert result["weaknesses"] == ["none"]

    def test_parse_ai_response_with_code_block_only(self):
        analyzer = AIAnalyzer()
        raw = '''```
{"education": {"score": 70}}
```'''
        result = analyzer.parse_ai_response(raw)
        assert result["education"]["score"] == 70


# ---------------------------------------------------------------------------
# local fallback analysis
# ---------------------------------------------------------------------------

class TestLocalFallbackAnalysis:
    def test_normalize_analysis_result_promotes_nested_strengths_and_weaknesses(self):
        analyzer = AIAnalyzer()
        result = {
            "skill_match": {"score": 20, "analysis": "技能不足", "matched_skills": ["Python"]},
            "experience_match": {"score": 0, "analysis": "无经验"},
            "education": {"score": 0, "analysis": "无学历信息"},
            "project_relevance": {"score": 0, "analysis": "无项目"},
            "overall_quality": {
                "score": 5,
                "analysis": "信息缺失",
                "strengths": [],
                "weaknesses": ["核心技能缺失", "无工作经验"],
            },
        }

        normalized = analyzer.normalize_analysis_result(
            result,
            {"required_skills": ["Python"], "weights": {}},
            {"skills": ["Python"], "email": "zhangsan@example.com"},
        )

        assert normalized["strengths"]
        assert normalized["weaknesses"] == ["核心技能缺失", "无工作经验"]
        assert normalized["skill_match"]["score"] == 20

    def test_build_local_analysis_returns_complete_shape(self):
        analyzer = AIAnalyzer()
        job_criteria = {
            "required_skills": ["Python", "FastAPI", "PostgreSQL"],
            "bonus_skills": ["Docker", "Redis"],
            "min_experience_years": 3,
            "education": "bachelor",
            "industry_preference": ["互联网"],
        }
        resume_data = {
            "name": "张三",
            "email": "zhangsan@example.com",
            "phone": "13800138000",
            "skills": ["Python", "FastAPI", "Docker", "Redis"],
            "education": [{"school": "清华大学", "degree": "硕士", "major": "计算机科学"}],
            "work_experience": [{"company": "ABC Tech", "description": "5 years backend development"}],
            "projects": [{"name": "API Platform", "description": "Python FastAPI Docker platform"}],
        }

        result = analyzer.build_local_analysis(job_criteria, resume_data)

        assert set(result.keys()) == {
            "skill_match",
            "experience_match",
            "education",
            "project_relevance",
            "overall_quality",
            "strengths",
            "weaknesses",
        }
        assert result["skill_match"]["matched_skills"] == ["Python", "FastAPI"]
        assert result["skill_match"]["missing_skills"] == ["PostgreSQL"]
        assert result["skill_match"]["bonus_skills_matched"] == ["Docker", "Redis"]
        assert result["experience_match"]["years_of_experience"] == 5
        assert result["education"]["degree_match"] is True
        assert result["project_relevance"]["relevant_projects"] == 1
        assert result["overall_quality"]["score"] >= 80
        assert result["strengths"]
        assert result["weaknesses"]

    def test_estimate_years_of_experience_uses_date_ranges_not_calendar_years(self):
        analyzer = AIAnalyzer()
        resume_data = {
            "work_experience": [
                {"start_date": "2022 年3 月", "end_date": "2025 年4 月"},
                {"start_date": "2025 年4 月", "end_date": "2025 年8 月"},
            ]
        }

        assert analyzer._estimate_years_of_experience(resume_data) == 3.5

    def test_estimate_years_of_experience_ignores_standalone_year_numbers(self):
        analyzer = AIAnalyzer()
        resume_data = {
            "work_experience": [
                {"description": "2025 年完成项目交付，准确率95%。"},
            ]
        }

        assert analyzer._estimate_years_of_experience(resume_data) == 2.0

    @pytest.mark.asyncio
    async def test_analyze_resume_uses_local_fallback_without_api_keys(self):
        analyzer = AIAnalyzer()
        analyzer.anthropic_client = None
        analyzer.openai_client = None
        analyzer.zhipu_client = None
        analyzer.settings.AI_ENABLE_LOCAL_FALLBACK = True

        result = await analyzer.analyze_resume(
            {
                "required_skills": ["React"],
                "bonus_skills": [],
                "min_experience_years": 0,
                "education": None,
                "weights": {},
            },
            {
                "name": "李四",
                "email": "lisi@example.com",
                "skills": ["React", "TypeScript"],
                "education": [],
                "work_experience": [],
                "projects": [],
            },
        )

        assert result["skill_match"]["score"] >= 80
        assert result["skill_match"]["matched_skills"] == ["React"]
        assert "overall_quality" in result

    @pytest.mark.asyncio
    async def test_analyze_resume_uses_zhipu_after_primary_providers_fail(self):
        analyzer = AIAnalyzer()
        analyzer.anthropic_client = None
        analyzer.openai_client = None
        analyzer.settings.AI_ENABLE_LOCAL_FALLBACK = False

        async def fake_zhipu_api(prompt: str) -> dict:
            return {
                "skill_match": {"score": 88, "analysis": "智谱模型返回技能匹配分析"},
                "experience_match": {"score": 80, "analysis": "经验满足要求"},
                "education": {"score": 90, "analysis": "学历满足要求"},
                "project_relevance": {"score": 82, "analysis": "项目相关"},
                "overall_quality": {"score": 86, "analysis": "简历完整"},
                "strengths": ["智谱模型可用"],
                "weaknesses": ["需要面试验证"],
            }

        analyzer.call_zhipu_api = fake_zhipu_api

        result = await analyzer.analyze_resume(
            {"required_skills": ["Python"], "weights": {}},
            {"skills": ["Python"]},
        )

        assert result["skill_match"]["score"] == 88
        assert result["strengths"] == ["智谱模型可用"]

    @pytest.mark.asyncio
    async def test_analyze_resume_can_fail_hard_when_local_fallback_disabled(self):
        analyzer = AIAnalyzer()
        analyzer.anthropic_client = None
        analyzer.openai_client = None
        analyzer.zhipu_client = None
        analyzer.settings.AI_ENABLE_LOCAL_FALLBACK = False

        with pytest.raises(ValueError, match="All AI services failed"):
            await analyzer.analyze_resume(
                {"required_skills": ["Python"], "weights": {}},
                {"skills": ["Python"]},
            )
