"""
Automated database migration script
Run this before deployments to apply schema changes
"""
import asyncio
import sys
from sqlalchemy import text
from config.db import engine


async def check_migration_status():
    """Check if migrations table exists"""
    async with engine.begin() as conn:
        result = await conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'schema_migrations'
            )
        """))
        return result.fetchone()[0]


async def create_migrations_table():
    """Create migrations tracking table"""
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))
        print("✓ Created schema_migrations table")


async def get_applied_migrations():
    """Get list of applied migrations"""
    async with engine.begin() as conn:
        result = await conn.execute(text("""
            SELECT version FROM schema_migrations ORDER BY version
        """))
        return [row[0] for row in result.fetchall()]


async def record_migration(version: str):
    """Record a migration as applied"""
    async with engine.begin() as conn:
        await conn.execute(text("""
            INSERT INTO schema_migrations (version) VALUES (:version)
            ON CONFLICT (version) DO NOTHING
        """), {"version": version})


async def run_migrations():
    """Run all pending migrations"""
    print("🗄️ Starting database migrations...")
    
    # Ensure migrations table exists
    if not await check_migration_status():
        await create_migrations_table()
    
    # Get applied migrations
    applied = await get_applied_migrations()
    print(f"✓ Found {len(applied)} applied migrations")
    
    # Define migrations (in order)
    migrations = {
        "001_initial_schema": """
            -- Initial schema is already created via individual table creation scripts
            SELECT 1;
        """,
        "002_add_indexes": """
            -- Indexes are already created
            SELECT 1;
        """,
        "003_enable_rls": """
            -- RLS already enabled on all tables
            SELECT 1;
        """,
    }
    
    # Run pending migrations
    pending_count = 0
    for version, sql in migrations.items():
        if version not in applied:
            print(f"\n🔄 Applying migration: {version}")
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(sql))
                    await record_migration(version)
                print(f"✅ Migration {version} applied successfully")
                pending_count += 1
            except Exception as e:
                print(f"❌ Migration {version} failed: {e}")
                sys.exit(1)
    
    if pending_count == 0:
        print("\n✅ No pending migrations")
    else:
        print(f"\n✅ Applied {pending_count} migrations successfully")
    
    return True


async def rollback_migration(version: str):
    """Rollback a specific migration"""
    print(f"⚠️ Rolling back migration: {version}")
    
    # Define rollback scripts
    rollbacks = {
        "001_initial_schema": "-- Cannot rollback initial schema",
        "002_add_indexes": "-- Drop indexes if needed",
        "003_enable_rls": "-- RLS rollback not recommended",
    }
    
    if version in rollbacks:
        async with engine.begin() as conn:
            await conn.execute(text(rollbacks[version]))
            await conn.execute(text("""
                DELETE FROM schema_migrations WHERE version = :version
            """), {"version": version})
        print(f"✅ Rolled back migration: {version}")
    else:
        print(f"❌ No rollback script for: {version}")


async def main():
    """Main migration runner"""
    import sys
    
    command = sys.argv[1] if len(sys.argv) > 1 else "migrate"
    
    if command == "migrate":
        await run_migrations()
    elif command == "rollback":
        version = sys.argv[2] if len(sys.argv) > 2 else None
        if version:
            await rollback_migration(version)
        else:
            print("❌ Please specify migration version to rollback")
            sys.exit(1)
    elif command == "status":
        applied = await get_applied_migrations()
        print(f"\n📊 Migration Status:")
        print(f"   Applied: {len(applied)} migrations")
        for version in applied:
            print(f"   ✓ {version}")
    else:
        print("Usage: python migrate.py [migrate|rollback|status]")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
