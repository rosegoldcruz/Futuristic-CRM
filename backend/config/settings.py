# Filepath: /srv/vulpine-os/backend/config/settings.py

import os
from functools import lru_cache
from dotenv import load_dotenv

# Load .env file
load_dotenv()


class Settings:
    # PostgreSQL/Supabase configuration
    DB_HOST: str = os.getenv("DB_HOST", "")
    DB_PORT: int = int(os.getenv("DB_PORT", "5432"))
    DB_USER: str = os.getenv("DB_USER", "postgres")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "")
    DB_NAME: str = os.getenv("DB_NAME", "postgres")
    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "10"))
    
    # Supabase specific
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    
    # Database URL for SQLAlchemy
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    @property
    def DATABASE_URL_SYNC(self) -> str:
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    API_DEBUG: bool = os.getenv("API_DEBUG", "false").lower() == "true"


@lru_cache
def get_settings() -> Settings:
    return Settings()
