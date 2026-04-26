from typing import Any, Optional

from app.models import Resume
from app.services.resume_parser import ResumeParser


_parser = ResumeParser()


def _safe_parsed_data(resume: Resume) -> dict[str, Any]:
    return resume.parsed_data if isinstance(resume.parsed_data, dict) else {}


def get_resume_basic_info(resume: Resume) -> dict[str, Any]:
    """Return display-ready basic info for a resume, including old parsed records."""
    parsed_data = _safe_parsed_data(resume)
    raw_text = parsed_data.get("raw_text")
    raw_basic_info: dict[str, Any] = {}

    if isinstance(raw_text, str) and raw_text.strip():
        raw_basic_info = _parser.extract_basic_info(raw_text)

    name = (
        _parser.clean_candidate_name(resume.candidate_name)
        or _parser.clean_candidate_name(parsed_data.get("name"))
        or _parser.clean_candidate_name(raw_basic_info.get("name"))
    )

    return {
        "name": name,
        "gender": parsed_data.get("gender") or raw_basic_info.get("gender"),
        "age": parsed_data.get("age") or raw_basic_info.get("age"),
        "email": resume.candidate_email or parsed_data.get("email") or raw_basic_info.get("email"),
        "phone": resume.candidate_phone or parsed_data.get("phone") or raw_basic_info.get("phone"),
    }


def get_display_candidate_name(resume: Resume, fallback: Optional[str] = None) -> str:
    basic_info = get_resume_basic_info(resume)
    return basic_info.get("name") or fallback or resume.file_name or "未知候选人"


def get_display_parsed_data(resume: Resume) -> dict[str, Any]:
    """Return parsed data normalized for API display without mutating stored records."""
    parsed_data = _safe_parsed_data(resume)
    basic_info = get_resume_basic_info(resume)
    raw_text = parsed_data.get("raw_text")
    clean_skills: list[str] = []

    if isinstance(raw_text, str) and raw_text.strip():
        clean_skills = _parser._extract_skills(raw_text)

    skills = parsed_data.get("skills")
    if not isinstance(skills, list):
        skills = []

    return {
        **parsed_data,
        "name": basic_info.get("name") or parsed_data.get("name"),
        "gender": basic_info.get("gender") or parsed_data.get("gender"),
        "age": basic_info.get("age") or parsed_data.get("age"),
        "email": basic_info.get("email") or parsed_data.get("email"),
        "phone": basic_info.get("phone") or parsed_data.get("phone"),
        "skills": clean_skills or skills,
    }
