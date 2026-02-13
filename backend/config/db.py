# Filepath: /srv/vulpine-os/backend/config/db.py

from typing import Any, Dict, List, Optional
from contextlib import asynccontextmanager
import asyncpg
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text

from .settings import get_settings

settings = get_settings()

# SQLAlchemy async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=5,
    echo=settings.API_DEBUG,
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base class for SQLAlchemy models
Base = declarative_base()


# Async context manager for sessions
@asynccontextmanager
async def get_session():
    """Get an async database session."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def fetch_all(query: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Execute a query and fetch all results as dictionaries."""
    async with get_session() as session:
        result = await session.execute(text(query), params or {})
        rows = result.fetchall()
        if rows:
            columns = result.keys()
            return [dict(zip(columns, row)) for row in rows]
        return []


async def fetch_one(query: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """Execute a query and fetch one result as a dictionary."""
    async with get_session() as session:
        result = await session.execute(text(query), params or {})
        row = result.fetchone()
        if row:
            columns = result.keys()
            return dict(zip(columns, row))
        return None


async def execute(query: str, params: Optional[Dict[str, Any]] = None) -> int:
    """Execute a query and return affected row count."""
    async with get_session() as session:
        result = await session.execute(text(query), params or {})
        return result.rowcount


async def execute_returning(query: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """Execute a query with RETURNING clause and return the result."""
    async with get_session() as session:
        result = await session.execute(text(query), params or {})
        row = result.fetchone()
        if row:
            columns = result.keys()
            return dict(zip(columns, row))
        return None


async def init_db():
    """Initialize database connection."""
    async with engine.begin() as conn:
        # Test connection
        await conn.execute(text("SELECT 1"))
    print("Database connection established")


async def close_db():
    """Close database connection."""
    await engine.dispose()
    print("Database connection closed")
