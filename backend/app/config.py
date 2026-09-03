from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ReviveAI API"
    app_version: str = "1.0.0"
    environment: str = "development"

    database_url: str = "sqlite:///./reviveai_demo.db"
    auto_create_tables: bool = True

    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None

    ai_api_key: str | None = None
    ai_model: str = "gpt-4.1-mini"

    payment_test_api_key: str | None = None
    payment_test_secret: str | None = None

    next_public_api_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    auth_enabled: bool = False
    api_auth_token: str = "reviveai-demo-token"

    max_automatic_retries: int = 1
    max_recovery_messages: int = 2
    min_ai_confidence_for_automation: float = 0.55

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
