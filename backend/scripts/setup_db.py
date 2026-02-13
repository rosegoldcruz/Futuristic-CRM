#!/usr/bin/env python3
"""
Setup script to initialize the Supabase database with schema and seed data.
Run this once to set up the database.
"""
import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncpg
from dotenv import load_dotenv

load_dotenv()

# Database connection settings
DB_HOST = os.getenv("DB_HOST", "")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "postgres")

# SQL files to apply in order
SQL_FILES = [
    "001_leads.sql",
    "002_calls.sql",
    "003_quotes.sql",
    "004_jobs_table.sql",
    "005_tenants_users.sql",
    "006_installers.sql",
    "007_homeowners.sql",
    "007a_patch_homeowners.sql",
    "008_suppliers.sql",
    "008a_patch_suppliers.sql",
    "009_payments.sql",
    "010_files.sql",
    "011_audit_logs.sql",
    "012_settings.sql",
    "013_automation.sql",
    "014_work_orders.sql",
    "015_documents.sql",
    "016_portals.sql",
    "017_ar_visualizer.sql",
    "018_marketing.sql",
    "019_metrics.sql",
]


async def get_connection():
    """Get a database connection."""
    return await asyncpg.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        ssl="require",
    )


async def apply_sql_file(conn, filepath: Path) -> bool:
    """Apply a single SQL file to the database."""
    if not filepath.exists():
        print(f"  ⚠️  File not found: {filepath.name}")
        return False
    
    sql_content = filepath.read_text()
    
    # Split into statements and execute each
    # Simple split on semicolons (may need refinement for complex SQL)
    statements = []
    current = []
    in_function = False
    
    for line in sql_content.split('\n'):
        stripped = line.strip()
        
        # Track if we're inside a function definition
        if 'CREATE OR REPLACE FUNCTION' in line.upper() or 'CREATE FUNCTION' in line.upper():
            in_function = True
        if in_function and stripped.startswith('$$'):
            if current and any('$$' in l for l in current):
                in_function = False
        
        current.append(line)
        
        # End of statement
        if stripped.endswith(';') and not in_function:
            statement = '\n'.join(current).strip()
            if statement and not statement.startswith('--'):
                statements.append(statement)
            current = []
    
    # Add any remaining content
    if current:
        statement = '\n'.join(current).strip()
        if statement and not statement.startswith('--'):
            statements.append(statement)
    
    errors = 0
    for i, stmt in enumerate(statements):
        if not stmt.strip() or stmt.strip().startswith('--'):
            continue
        try:
            await conn.execute(stmt)
        except asyncpg.exceptions.DuplicateObjectError as e:
            # Type/table already exists - skip
            pass
        except asyncpg.exceptions.DuplicateTableError as e:
            # Table already exists - skip
            pass
        except Exception as e:
            error_msg = str(e)
            # Ignore common "already exists" errors
            if 'already exists' in error_msg.lower():
                pass
            elif 'does not exist' in error_msg.lower() and 'DROP' in stmt.upper():
                pass
            else:
                print(f"    Error in statement {i+1}: {error_msg[:100]}")
                errors += 1
    
    return errors == 0


async def seed_demo_data(conn):
    """Seed minimum demo data."""
    print("\n📦 Seeding demo data...")
    
    try:
        # Check if tenant exists
        existing = await conn.fetchval("SELECT id FROM tenants WHERE name = 'Vulpine Demo' LIMIT 1")
        if existing:
            print("  ✓ Demo data already exists")
            return
        
        # Create tenant
        tenant_id = await conn.fetchval("""
            INSERT INTO tenants (name, slug, status)
            VALUES ('Vulpine Demo', 'vulpine-demo', 'active')
            RETURNING id
        """)
        print(f"  ✓ Created tenant: Vulpine Demo (ID: {tenant_id})")
        
        # Create admin user
        user_id = await conn.fetchval("""
            INSERT INTO users (tenant_id, email, role, first_name, last_name, status)
            VALUES ($1, 'admin@vulpine.local', 'admin', 'Admin', 'User', 'active')
            RETURNING id
        """, tenant_id)
        print(f"  ✓ Created admin user (ID: {user_id})")
        
        # Create installer
        installer_id = await conn.fetchval("""
            INSERT INTO installers (tenant_id, first_name, last_name, phone, email, status, tier, service_area_zips)
            VALUES ($1, 'Demo', 'Installer', '555-0100', 'installer@vulpine.local', 'active', 'standard', ARRAY['85001', '85002', '85003'])
            RETURNING id
        """, tenant_id)
        print(f"  ✓ Created installer: Demo Installer (ID: {installer_id})")
        
        # Create homeowner
        homeowner_id = await conn.fetchval("""
            INSERT INTO homeowners (tenant_id, first_name, last_name, phone, email, address_street, address_city, address_state, address_zip)
            VALUES ($1, 'Jane', 'Doe', '555-0200', 'jane@example.com', '123 Main St', 'Phoenix', 'AZ', '85001')
            RETURNING id
        """, tenant_id)
        print(f"  ✓ Created homeowner: Jane Doe (ID: {homeowner_id})")
        
        # Create lead
        lead_id = await conn.fetchval("""
            INSERT INTO leads (tenant_id, customer_name, customer_email, customer_phone, source, status)
            VALUES ($1, 'John Smith', 'john@example.com', '555-0300', 'website', 'new')
            RETURNING id
        """, tenant_id)
        print(f"  ✓ Created lead: John Smith (ID: {lead_id})")
        
        # Create job
        job_id = await conn.fetchval("""
            INSERT INTO jobs (tenant_id, homeowner_id, customer_name, status, project_details)
            VALUES ($1, $2, 'Jane Doe', 'pending', '{"description": "Kitchen cabinet refacing", "cabinets": 12, "drawers": 6}'::jsonb)
            RETURNING id
        """, tenant_id, homeowner_id)
        print(f"  ✓ Created job (ID: {job_id})")
        
        # Create supplier
        supplier_id = await conn.fetchval("""
            INSERT INTO suppliers (tenant_id, name, contact_name, email, phone, supplier_type, city, state, is_active)
            VALUES ($1, 'Cabinet Supply Co', 'Bob Wilson', 'bob@cabinetsupply.com', '555-0400', 'materials', 'Phoenix', 'AZ', true)
            RETURNING id
        """, tenant_id)
        print(f"  ✓ Created supplier: Cabinet Supply Co (ID: {supplier_id})")
        
        print("\n✅ Demo data seeded successfully!")
        
    except Exception as e:
        print(f"  ❌ Error seeding data: {e}")


async def list_tables(conn):
    """List all tables in the database."""
    print("\n📋 Database tables:")
    tables = await conn.fetch("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    for t in tables:
        print(f"  • {t['table_name']}")
    print(f"\nTotal: {len(tables)} tables")


async def main():
    print("🚀 Vulpine OS Database Setup")
    print("=" * 50)
    print(f"Host: {DB_HOST}")
    print(f"Database: {DB_NAME}")
    print()
    
    try:
        conn = await get_connection()
        print("✓ Connected to database\n")
    except Exception as e:
        print(f"❌ Failed to connect: {e}")
        return
    
    # Find SQL directory
    sql_dir = Path(__file__).parent.parent.parent / "sql"
    if not sql_dir.exists():
        print(f"❌ SQL directory not found: {sql_dir}")
        await conn.close()
        return
    
    print(f"📁 SQL directory: {sql_dir}\n")
    print("📥 Applying schema files...")
    
    for filename in SQL_FILES:
        filepath = sql_dir / filename
        print(f"  → {filename}...", end=" ")
        success = await apply_sql_file(conn, filepath)
        if success:
            print("✓")
        else:
            print("(with warnings)")
    
    # Seed demo data
    await seed_demo_data(conn)
    
    # List tables
    await list_tables(conn)
    
    await conn.close()
    print("\n✅ Database setup complete!")


if __name__ == "__main__":
    asyncio.run(main())
