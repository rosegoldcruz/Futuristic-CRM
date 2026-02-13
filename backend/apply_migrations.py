#!/usr/bin/env python3
"""
Apply SQL migrations to Supabase database
"""
import asyncio
import sys
from pathlib import Path
from config.db import engine
from sqlalchemy import text

async def apply_migration(filepath: Path):
    """Apply a single migration file"""
    print(f"Applying migration: {filepath.name}")
    
    sql_content = filepath.read_text()
    
    async with engine.begin() as conn:
        # Execute the entire migration file
        await conn.execute(text(sql_content))
    
    print(f"✓ Applied: {filepath.name}")

async def main():
    """Apply all pending migrations"""
    migrations_dir = Path(__file__).parent.parent / "supabase" / "migrations"
    
    if not migrations_dir.exists():
        print(f"❌ Migrations directory not found: {migrations_dir}")
        sys.exit(1)
    
    # Get all .sql files sorted by name
    migration_files = sorted(migrations_dir.glob("*.sql"))
    
    if not migration_files:
        print("⚠ No migration files found")
        return
    
    print(f"\n{'='*60}")
    print(f"APPLYING {len(migration_files)} MIGRATIONS")
    print(f"{'='*60}\n")
    
    for migration_file in migration_files:
        try:
            await apply_migration(migration_file)
        except Exception as e:
            print(f"❌ Error applying {migration_file.name}: {e}")
            # Continue with other migrations
            continue
    
    print(f"\n✅ Migration process complete!\n")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
