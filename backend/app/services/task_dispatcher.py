from __future__ import annotations

import asyncio
import logging
from concurrent.futures import Future, ThreadPoolExecutor
from threading import Lock
from typing import Any, Callable

from app.config import get_settings

logger = logging.getLogger(__name__)

_executor: ThreadPoolExecutor | None = None
_executor_lock = Lock()
_executor_workers: int | None = None
_local_futures: set[Future[Any]] = set()


def _get_executor() -> ThreadPoolExecutor:
    global _executor, _executor_workers

    settings = get_settings()
    max_workers = max(1, settings.LOCAL_TASK_MAX_WORKERS)

    with _executor_lock:
        if _executor is None or _executor_workers != max_workers:
            if _executor is not None:
                _executor.shutdown(wait=False, cancel_futures=False)
            _executor = ThreadPoolExecutor(
                max_workers=max_workers,
                thread_name_prefix="resume-local-task",
            )
            _executor_workers = max_workers

    return _executor


def _run_async_job(
    job_name: str,
    coro_factory: Callable[..., Any],
    *args: Any,
) -> None:
    logger.info("Running %s locally", job_name)
    asyncio.run(coro_factory(*args))


def _track_future(future: Future[Any], job_name: str) -> None:
    _local_futures.add(future)

    def _cleanup(done: Future[Any]) -> None:
        _local_futures.discard(done)
        try:
            done.result()
        except Exception:
            logger.exception("Local background job failed: %s", job_name)

    future.add_done_callback(_cleanup)


def _submit_local_job(
    job_name: str,
    coro_factory: Callable[..., Any],
    *args: Any,
) -> str:
    future = _get_executor().submit(_run_async_job, job_name, coro_factory, *args)
    _track_future(future, job_name)
    return "local"


def dispatch_resume_parse(resume_id: str, file_path: str, file_type: str) -> str:
    settings = get_settings()
    mode = settings.TASK_EXECUTION_MODE.lower().strip()

    if mode in {"celery", "auto"}:
        from app.tasks.parse_resume import parse_resume_task

        try:
            parse_resume_task.delay(resume_id, file_path, file_type)
            return "celery"
        except Exception:
            if mode == "celery":
                raise
            logger.exception("Celery dispatch failed for resume parse, falling back to local execution")

    from app.tasks.parse_resume import run_parse_resume

    return _submit_local_job("resume-parse", run_parse_resume, resume_id, file_path, file_type)


def dispatch_resume_analysis(resume_id: str, job_requirement_id: str) -> str:
    settings = get_settings()
    mode = settings.TASK_EXECUTION_MODE.lower().strip()

    if mode in {"celery", "auto"}:
        from app.tasks.analyze_resume import analyze_resume_task

        try:
            analyze_resume_task.delay(resume_id, job_requirement_id)
            return "celery"
        except Exception:
            if mode == "celery":
                raise
            logger.exception("Celery dispatch failed for resume analysis, falling back to local execution")

    from app.tasks.analyze_resume import run_analyze_resume

    return _submit_local_job("resume-analysis", run_analyze_resume, resume_id, job_requirement_id)
