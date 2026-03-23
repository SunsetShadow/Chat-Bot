from pydantic import Extra, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra=Extra.ignore,  # 忽略环境变量中的额外字段
    )

    # 应用配置
    app_name: str = "Chat Bot API"
    debug: bool = False

    # LLM 配置
    openai_api_key: str = ""
    openai_base_url: str = ""  # 可选，用于代理
    openai_model: str = "gpt-4o"

    # CORS 配置（支持逗号分隔的字符串或列表）
    cors_origins: list[str] = ["http://localhost:3000"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


settings = Settings()
