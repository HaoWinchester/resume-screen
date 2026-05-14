#!/usr/bin/env python3
"""Dry-run-first cleanup for obvious test candidate records.

Default behavior is read-only. Pass --apply to delete matched resumes.
The script intentionally does not delete job requirements by default because a
real resume may be attached to a job with a test-looking title.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.models import JobRequirement, Resume  # noqa: E402


DEFAULT_CANDIDATE_NAMES = ["Zhang San", "张三"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="List or delete obvious test resume records.")
    parser.add_argument("--apply", action="store_true", help="Actually delete matched resumes.")
    parser.add_argument(
        "--candidate-name",
        action="append",
        default=[],
        help="Candidate name to match exactly. Can be repeated.",
    )
    return parser.parse_args()


async def main() -> int:
    args = parse_args()
    names = args.candidate_name or DEFAULT_CANDIDATE_NAMES

    os.chdir(BACKEND_DIR)
    load_dotenv(BACKEND_DIR / ".env", override=True)
    database_url = os.environ.get("DATABASE_URL") or get_settings().DATABASE_URL
    engine = create_async_engine(database_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        result = await session.execute(
            select(Resume, JobRequirement)
            .join(JobRequirement, Resume.job_requirement_id == JobRequirement.id)
            .where(Resume.candidate_name.in_(names))
            .order_by(Resume.created_at.desc())
        )
        rows = result.all()

        print(f"Matched {len(rows)} resume(s) for candidate names: {', '.join(names)}")
        for resume, job in rows:
            print(
                f"- resume={resume.id} candidate={resume.candidate_name!r} "
                f"file={resume.file_name!r} job={job.title!r} created_at={resume.created_at}"
            )

        if not args.apply:
            print("\nDry run only. Re-run with --apply to delete these resumes.")
            await engine.dispose()
            return 0

        for resume, _ in rows:
            await session.delete(resume)
        await session.commit()
        print(f"\nDeleted {len(rows)} resume(s).")

    await engine.dispose()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
