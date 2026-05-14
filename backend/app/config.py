from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/resume_assistant"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Auth
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    CORS_ORIGINS: str = (
        "http://localhost:3000,"
        "http://localhost:3004,"
        "http://localhost:3005,"
        "http://127.0.0.1:3000,"
        "http://127.0.0.1:3004,"
        "http://127.0.0.1:3005"
    )
    CORS_ORIGIN_REGEX: str = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"

    # AI
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    ZHIPU_API_KEY: str = ""
    ZHIPU_BASE_URL: str = "https://open.bigmodel.cn/api/paas/v4/"
    ZHIPU_MODEL: str = "glm-4-flash"
    AI_PROVIDER: str = "auto"  # auto, local, zhipu, openai, anthropic
    AI_PROVIDER_ORDER: str = "zhipu,openai,anthropic"
    AI_ENABLE_LOCAL_FALLBACK: bool = True
    AI_RESUME_PARSER_ENABLED: bool = True
    AI_RESUME_PARSER_PROVIDER: str = "auto"  # auto, local, zhipu, openai, anthropic
    AI_RESUME_PARSER_PROVIDER_ORDER: str = "zhipu,openai,anthropic"
    ANTHROPIC_RESUME_PARSER_MODEL: str = "claude-opus-4-7"
    OPENAI_RESUME_PARSER_MODEL: str = "gpt-4o"
    AGENT_TEAM_AUTO_RUN_ENABLED: bool = True

    # File Storage
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 20
    MAX_FILES_PER_UPLOAD: int = 100

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    TASK_EXECUTION_MODE: str = "local"  # local, celery, auto
    LOCAL_TASK_MAX_WORKERS: int = 2

    # Email delivery. Use EMAIL_DELIVERY_MODE=smtp with SMTP_* values to send
    # real emails; console mode prints the composed message in local dev.
    EMAIL_DELIVERY_MODE: str = "console"  # console, smtp
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "HR Talent"
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False

    # Interview reminders are generated when an interview is scheduled and
    # dispatched by a lightweight in-process worker while the API is running.
    INTERVIEW_REMINDER_WORKER_ENABLED: bool = True
    INTERVIEW_REMINDER_POLL_SECONDS: int = 60

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
