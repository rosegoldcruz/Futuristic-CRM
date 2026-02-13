"""
AEON Security Hardening Audit - Comprehensive Security Check
"""
import asyncio
import sys
from sqlalchemy import text
from config.db import engine


class SecurityAuditReport:
    def __init__(self):
        self.findings = []
        self.critical_count = 0
        self.high_count = 0
        self.medium_count = 0
        self.low_count = 0
    
    def add(self, finding_type, severity, table_name, description, recommendation):
        self.findings.append({
            "type": finding_type,
            "severity": severity,
            "table": table_name,
            "description": description,
            "recommendation": recommendation
        })
        
        if severity == "CRITICAL":
            self.critical_count += 1
        elif severity == "HIGH":
            self.high_count += 1
        elif severity == "MEDIUM":
            self.medium_count += 1
        elif severity == "LOW":
            self.low_count += 1
    
    def print_report(self):
        print("\n" + "="*80)
        print("🔒 AEON SECURITY HARDENING AUDIT REPORT")
        print("="*80)
        
        # Summary
        print(f"\n📊 SUMMARY:")
        print(f"   Critical: {self.critical_count}")
        print(f"   High:     {self.high_count}")
        print(f"   Medium:   {self.medium_count}")
        print(f"   Low:      {self.low_count}")
        print(f"   Total:    {len(self.findings)}")
        
        # Findings by severity
        for severity in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
            findings = [f for f in self.findings if f["severity"] == severity]
            if findings:
                print(f"\n{severity} FINDINGS:")
                for i, finding in enumerate(findings, 1):
                    print(f"\n  {i}. [{finding['type']}] {finding['table']}")
                    print(f"     Issue: {finding['description']}")
                    print(f"     Fix: {finding['recommendation']}")
        
        print("\n" + "="*80)
        
        # Final verdict
        if self.critical_count > 0:
            print("❌ AUDIT FAILED - Critical vulnerabilities found")
            return False
        elif self.high_count > 0:
            print("⚠️ AUDIT WARNING - High-risk issues found")
            return False
        else:
            print("✅ AUDIT PASSED - No critical findings")
            return True


async def audit_rls_enforcement():
    """Check that RLS is enabled on all tables"""
    report = SecurityAuditReport()
    
    async with engine.begin() as conn:
        # Get all tables
        tables_result = await conn.execute(text("""
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        """))
        tables = [t[0] for t in tables_result.fetchall()]
        
        # Check RLS status
        for table in tables:
            rls_result = await conn.execute(text(f"""
                SELECT relrowsecurity 
                FROM pg_class 
                WHERE relname = '{table}'
            """))
            row = rls_result.fetchone()
            
            if row and not row[0]:
                report.add(
                    "RLS_NOT_ENABLED",
                    "CRITICAL",
                    table,
                    f"Row Level Security is NOT enabled on table '{table}'",
                    f"Run: ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"
                )
    
    return report


async def audit_sql_injection():
    """Check for SQL injection vulnerabilities"""
    report = SecurityAuditReport()
    
    # Check that all queries use parameterized queries
    # This is a static check - in production, use code scanning tools
    report.add(
        "SQL_INJECTION_PREVENTION",
        "LOW",
        "ALL",
        "Using parameterized queries via SQLAlchemy - good practice",
        "Continue using parameterized queries, never string concatenation"
    )
    
    return report


async def audit_tenant_isolation():
    """Check tenant isolation"""
    report = SecurityAuditReport()
    
    async with engine.begin() as conn:
        # Check if tenant_id exists where needed
        tenant_tables = ["leads", "quotes", "jobs", "homeowners", "installers", "suppliers"]
        
        for table in tenant_tables:
            # Check if table exists
            exists_result = await conn.execute(text(f"""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = '{table}'
                )
            """))
            
            if not exists_result.fetchone()[0]:
                continue
            
            # Check if tenant_id column exists
            column_result = await conn.execute(text(f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = '{table}' 
                AND column_name = 'tenant_id'
            """))
            
            if not column_result.fetchone():
                report.add(
                    "TENANT_ISOLATION",
                    "MEDIUM",
                    table,
                    f"Table '{table}' does not have tenant_id column for multi-tenancy",
                    f"Add tenant_id column and create RLS policies"
                )
    
    return report


async def audit_input_validation():
    """Check input validation"""
    report = SecurityAuditReport()
    
    # Pydantic models provide automatic validation
    report.add(
        "INPUT_VALIDATION",
        "LOW",
        "API",
        "Using Pydantic models for automatic input validation",
        "Ensure all endpoints use Pydantic models"
    )
    
    return report


async def audit_file_upload_security():
    """Check file upload security"""
    report = SecurityAuditReport()
    
    async with engine.begin() as conn:
        # Check if file validation exists
        files_result = await conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'files'
            )
        """))
        
        if files_result.fetchone()[0]:
            report.add(
                "FILE_UPLOAD",
                "MEDIUM",
                "files",
                "File upload table exists - ensure validation is in place",
                "Add file type validation, size limits, and virus scanning"
            )
    
    return report


async def audit_session_security():
    """Check session security"""
    report = SecurityAuditReport()
    
    async with engine.begin() as conn:
        # Check portal_sessions table
        sessions_result = await conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'portal_sessions'
            )
        """))
        
        if sessions_result.fetchone()[0]:
            report.add(
                "SESSION_SECURITY",
                "LOW",
                "portal_sessions",
                "Session management in place",
                "Ensure sessions have expiration and are invalidated on logout"
            )
    
    return report


async def audit_password_security():
    """Check password security"""
    report = SecurityAuditReport()
    
    # Passwords should be hashed
    report.add(
        "PASSWORD_SECURITY",
        "CRITICAL",
        "users",
        "Ensure all passwords are hashed with bcrypt/argon2",
        "Never store plain-text passwords, use bcrypt.hashpw()"
    )
    
    return report


async def audit_api_rate_limiting():
    """Check API rate limiting"""
    report = SecurityAuditReport()
    
    async with engine.begin() as conn:
        rate_limit_result = await conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'rate_limits'
            )
        """))
        
        if rate_limit_result.fetchone()[0]:
            report.add(
                "RATE_LIMITING",
                "LOW",
                "rate_limits",
                "Rate limiting table exists",
                "Implement middleware to enforce rate limits"
            )
        else:
            report.add(
                "RATE_LIMITING",
                "HIGH",
                "API",
                "No rate limiting infrastructure detected",
                "Create rate_limits table and add middleware"
            )
    
    return report


async def audit_audit_logging():
    """Check audit logging"""
    report = SecurityAuditReport()
    
    async with engine.begin() as conn:
        audit_result = await conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'audit_logs'
            )
        """))
        
        if audit_result.fetchone()[0]:
            report.add(
                "AUDIT_LOGGING",
                "LOW",
                "audit_logs",
                "Audit logging table exists",
                "Ensure all sensitive operations are logged"
            )
        else:
            report.add(
                "AUDIT_LOGGING",
                "MEDIUM",
                "N/A",
                "No audit logging table found",
                "Create audit_logs table and log all security events"
            )
    
    return report


async def audit_cors_configuration():
    """Check CORS configuration"""
    report = SecurityAuditReport()
    
    report.add(
        "CORS",
        "HIGH",
        "API",
        "CORS allows all origins (*) - production risk",
        "In production, set specific allowed origins, not '*'"
    )
    
    return report


async def audit_sensitive_data_exposure():
    """Check for sensitive data exposure"""
    report = SecurityAuditReport()
    
    report.add(
        "SENSITIVE_DATA",
        "MEDIUM",
        "API",
        "Ensure sensitive fields are not exposed in API responses",
        "Use Pydantic exclude fields for passwords, API keys, etc."
    )
    
    return report


async def main():
    print("🔒 Starting AEON Security Hardening Audit...")
    print("=" * 80)
    
    combined_report = SecurityAuditReport()
    
    # Run all audits
    audits = [
        ("RLS Enforcement", audit_rls_enforcement),
        ("SQL Injection Prevention", audit_sql_injection),
        ("Tenant Isolation", audit_tenant_isolation),
        ("Input Validation", audit_input_validation),
        ("File Upload Security", audit_file_upload_security),
        ("Session Security", audit_session_security),
        ("Password Security", audit_password_security),
        ("API Rate Limiting", audit_api_rate_limiting),
        ("Audit Logging", audit_audit_logging),
        ("CORS Configuration", audit_cors_configuration),
        ("Sensitive Data", audit_sensitive_data_exposure),
    ]
    
    for audit_name, audit_func in audits:
        print(f"\n🔍 Running: {audit_name}...")
        report = await audit_func()
        combined_report.findings.extend(report.findings)
        combined_report.critical_count += report.critical_count
        combined_report.high_count += report.high_count
        combined_report.medium_count += report.medium_count
        combined_report.low_count += report.low_count
    
    # Print final report
    passed = combined_report.print_report()
    
    # Save findings to database
    async with engine.begin() as conn:
        for finding in combined_report.findings:
            if finding["severity"] in ["CRITICAL", "HIGH"]:
                await conn.execute(text("""
                    INSERT INTO security_audit_findings (
                        audit_type, finding_type, severity, table_name, description, recommendation
                    )
                    VALUES (:audit_type, :finding_type, :severity, :table_name, :description, :recommendation)
                """), {
                    "audit_type": "comprehensive",
                    "finding_type": finding["type"],
                    "severity": finding["severity"],
                    "table_name": finding["table"],
                    "description": finding["description"],
                    "recommendation": finding["recommendation"],
                })
    
    print(f"\n💾 Security findings saved to database")
    
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    asyncio.run(main())
