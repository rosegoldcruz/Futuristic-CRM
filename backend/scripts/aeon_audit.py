#!/usr/bin/env python3
"""
AEON Recursive Self-Audit Engine
================================
Validates entire stack integrity:
- Backend routers + return shapes
- Database schema (Supabase)
- Frontend types + fetch calls
- Environment variables
- Endpoint → Type → Component contracts

Run after EVERY task to ensure zero drift.
"""

import asyncio
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

load_dotenv()


@dataclass
class AuditResult:
    category: str
    status: str  # "PASS", "FAIL", "WARN"
    message: str
    details: list = field(default_factory=list)


@dataclass
class AuditReport:
    results: list = field(default_factory=list)
    passed: int = 0
    failed: int = 0
    warnings: int = 0

    def add(self, result: AuditResult):
        self.results.append(result)
        if result.status == "PASS":
            self.passed += 1
        elif result.status == "FAIL":
            self.failed += 1
        else:
            self.warnings += 1

    def print_report(self):
        print("\n" + "=" * 60)
        print("🔍 AEON RECURSIVE SELF-AUDIT REPORT")
        print("=" * 60)

        for r in self.results:
            icon = "✅" if r.status == "PASS" else "❌" if r.status == "FAIL" else "⚠️"
            print(f"\n{icon} [{r.category}] {r.message}")
            for d in r.details[:5]:  # Limit details
                print(f"   → {d}")
            if len(r.details) > 5:
                print(f"   → ... and {len(r.details) - 5} more")

        print("\n" + "-" * 60)
        print(f"📊 SUMMARY: {self.passed} passed, {self.failed} failed, {self.warnings} warnings")
        
        if self.failed == 0:
            print("🎉 ALL CHECKS PASSED - System integrity verified")
        else:
            print("🚨 AUDIT FAILED - Fix issues before proceeding")
        print("=" * 60 + "\n")
        
        return self.failed == 0


class AEONAuditEngine:
    def __init__(self, project_root: Path):
        self.root = project_root
        self.backend = project_root / "backend"
        self.frontend = project_root / "frontend"
        self.report = AuditReport()

    # =========================================================================
    # 1. ENVIRONMENT VALIDATION
    # =========================================================================
    def audit_environment(self):
        """Check all required environment variables exist."""
        required_backend = [
            "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME",
            "SUPABASE_URL"
        ]
        required_frontend = [
            "NEXT_PUBLIC_API_BASE", "NEXT_PUBLIC_SUPABASE_URL"
        ]
        
        # Check backend .env
        backend_env = self.backend / ".env"
        missing_backend = []
        if backend_env.exists():
            content = backend_env.read_text()
            for var in required_backend:
                pattern = rf"^{var}=.+"
                if not re.search(pattern, content, re.MULTILINE):
                    missing_backend.append(var)
        else:
            missing_backend = required_backend
        
        if missing_backend:
            self.report.add(AuditResult(
                "ENV", "FAIL",
                f"Missing backend env vars: {', '.join(missing_backend)}",
                [f"Add to backend/.env: {v}=<value>" for v in missing_backend]
            ))
        else:
            self.report.add(AuditResult("ENV", "PASS", "Backend environment configured"))

        # Check frontend .env.local
        frontend_env = self.frontend / ".env.local"
        missing_frontend = []
        if frontend_env.exists():
            content = frontend_env.read_text()
            for var in required_frontend:
                pattern = rf"^{var}=.+"
                if not re.search(pattern, content, re.MULTILINE):
                    missing_frontend.append(var)
        else:
            missing_frontend = required_frontend

        if missing_frontend:
            self.report.add(AuditResult(
                "ENV", "FAIL",
                f"Missing frontend env vars: {', '.join(missing_frontend)}",
                [f"Add to frontend/.env.local: {v}=<value>" for v in missing_frontend]
            ))
        else:
            self.report.add(AuditResult("ENV", "PASS", "Frontend environment configured"))

        # Check for hardcoded secrets in source
        secrets_patterns = [
            r"password\s*=\s*['\"][A-Za-z0-9!@#$%^&*]{8,}['\"]",
            r"api_key\s*=\s*['\"][A-Za-z0-9_-]{20,}['\"]",
            r"secret\s*=\s*['\"][A-Za-z0-9_-]{20,}['\"]",
        ]
        # Skip audit script itself
        skip_files = ["aeon_audit.py"]
        
        hardcoded = []
        for pattern in secrets_patterns:
            for ext in ["*.py", "*.ts", "*.tsx", "*.js"]:
                for f in self.root.rglob(ext):
                    if "node_modules" in str(f) or ".next" in str(f):
                        continue
                    if f.name in skip_files:
                        continue
                    try:
                        content = f.read_text()
                        if re.search(pattern, content, re.IGNORECASE):
                            hardcoded.append(str(f.relative_to(self.root)))
                    except:
                        pass

        if hardcoded:
            self.report.add(AuditResult(
                "SECURITY", "FAIL",
                "Potential hardcoded secrets detected",
                hardcoded[:10]
            ))
        else:
            self.report.add(AuditResult("SECURITY", "PASS", "No hardcoded secrets detected"))

    # =========================================================================
    # 2. BACKEND VALIDATION
    # =========================================================================
    def audit_backend_imports(self):
        """Check all backend imports resolve."""
        errors = []
        
        for py_file in self.backend.rglob("*.py"):
            if "__pycache__" in str(py_file):
                continue
            try:
                content = py_file.read_text()
                # Check for common import issues
                imports = re.findall(r"^(?:from|import)\s+(\S+)", content, re.MULTILINE)
                for imp in imports:
                    # Skip stdlib and installed packages
                    if imp.startswith(("os", "sys", "json", "typing", "datetime", "asyncio", 
                                       "fastapi", "pydantic", "sqlalchemy", "asyncpg", "httpx")):
                        continue
                    # Check local imports
                    if imp.startswith(("config", "models", "routers", "services")):
                        module_path = self.backend / imp.replace(".", "/")
                        if not (module_path.exists() or (module_path.parent / f"{module_path.name}.py").exists()):
                            if not (self.backend / f"{imp.split('.')[0]}").exists():
                                errors.append(f"{py_file.name}: {imp}")
            except Exception as e:
                errors.append(f"{py_file.name}: read error - {e}")

        if errors:
            self.report.add(AuditResult(
                "BACKEND", "WARN",
                f"Potential import issues: {len(errors)}",
                errors[:10]
            ))
        else:
            self.report.add(AuditResult("BACKEND", "PASS", "Backend imports OK"))

    def audit_backend_syntax(self):
        """Check backend Python syntax."""
        result = subprocess.run(
            ["python3", "-m", "py_compile"] + [str(f) for f in self.backend.rglob("*.py") if "__pycache__" not in str(f)],
            capture_output=True, text=True, cwd=self.backend
        )
        
        if result.returncode != 0:
            self.report.add(AuditResult(
                "BACKEND", "FAIL",
                "Python syntax errors",
                result.stderr.split("\n")[:5]
            ))
        else:
            self.report.add(AuditResult("BACKEND", "PASS", "Backend syntax OK"))

    def audit_backend_routers(self):
        """Extract and validate router endpoints."""
        routers_dir = self.backend / "routers"
        endpoints = []
        
        for router_file in routers_dir.glob("*.py"):
            if router_file.name == "__init__.py":
                continue
            content = router_file.read_text()
            
            # Find route decorators
            routes = re.findall(
                r'@router\.(get|post|put|delete|patch)\s*\(\s*["\']([^"\']+)["\']',
                content
            )
            for method, path in routes:
                endpoints.append({
                    "file": router_file.name,
                    "method": method.upper(),
                    "path": path
                })

        if endpoints:
            self.report.add(AuditResult(
                "BACKEND", "PASS",
                f"Found {len(endpoints)} API endpoints",
                [f"{e['method']} {e['path']} ({e['file']})" for e in endpoints[:10]]
            ))
        else:
            self.report.add(AuditResult(
                "BACKEND", "WARN",
                "No API endpoints found in routers"
            ))
        
        return endpoints

    # =========================================================================
    # 3. DATABASE VALIDATION
    # =========================================================================
    async def audit_database(self):
        """Validate database connection and schema."""
        try:
            import asyncpg
            
            conn = await asyncpg.connect(
                host=os.getenv("DB_HOST"),
                port=int(os.getenv("DB_PORT", "5432")),
                user=os.getenv("DB_USER", "postgres"),
                password=os.getenv("DB_PASSWORD"),
                database=os.getenv("DB_NAME", "postgres"),
                ssl="require"
            )
            
            # Get tables
            tables = await conn.fetch("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """)
            table_names = [t["table_name"] for t in tables]
            
            expected_tables = ["tenants", "users", "leads", "homeowners", "installers", 
                               "suppliers", "quotes", "jobs", "files", "products", "work_orders", "payments", "documents", "ar_visualizer",
                               "marketing_events", "marketing_campaigns", "automations", "automation_runs", "automation_action_logs", "audit_logs",
                               "payment_methods", "ledger_entries", "platform_fees",
                               "supplier_orders", "supplier_order_items", "shipment_logs",
                               "work_order_tasks", "work_order_photos", "work_order_time_entries", "work_order_signatures",
                               "portal_sessions", "portal_messages", "portal_notifications", "portal_activity_log",
                               "document_templates", "document_signatures", "document_versions", "document_audit_log",
                               "landing_pages", "landing_page_views", "landing_page_conversions",
                               "notification_templates", "notification_preferences", "notification_queue", "notification_delivery_log",
                               "metric_definitions", "metric_snapshots", "dashboard_widgets", "metric_cache",
                               "system_settings", "integrations", "feature_flags", "settings_audit_log",
                               "event_bus", "dead_letter_queue", "system_health", "workflow_executions",
                               "query_cache", "query_performance", "api_performance", "performance_snapshots",
                               "security_events", "rate_limits", "file_uploads", "security_audit_findings",
                               "subscription_plans", "stripe_customers", "subscriptions", "invoices", "usage_records", "billing_events",
                               "superadmin_users", "tenant_metadata", "impersonation_logs", "system_errors", "global_metrics_cache"]
            missing = [t for t in expected_tables if t not in table_names]
            
            if missing:
                self.report.add(AuditResult(
                    "DATABASE", "FAIL",
                    f"Missing tables: {', '.join(missing)}",
                    [f"Run schema migration to create: {t}" for t in missing]
                ))
            else:
                self.report.add(AuditResult(
                    "DATABASE", "PASS",
                    f"All {len(expected_tables)} expected tables exist",
                    table_names
                ))

            # Check RLS status
            rls_status = await conn.fetch("""
                SELECT tablename, rowsecurity 
                FROM pg_tables 
                WHERE schemaname = 'public'
            """)
            no_rls = [r["tablename"] for r in rls_status if not r["rowsecurity"]]
            
            if no_rls:
                self.report.add(AuditResult(
                    "DATABASE", "WARN",
                    f"RLS disabled on {len(no_rls)} tables",
                    no_rls[:5]
                ))
            else:
                self.report.add(AuditResult("DATABASE", "PASS", "RLS enabled on all tables"))

            await conn.close()
            
        except Exception as e:
            self.report.add(AuditResult(
                "DATABASE", "FAIL",
                f"Database connection failed: {str(e)[:100]}"
            ))

    # =========================================================================
    # 4. FRONTEND VALIDATION
    # =========================================================================
    def audit_frontend_typescript(self):
        """Check TypeScript compilation."""
        result = subprocess.run(
            ["npx", "tsc", "--noEmit", "--skipLibCheck"],
            capture_output=True, text=True, cwd=self.frontend
        )
        
        if result.returncode != 0:
            errors = [l for l in result.stdout.split("\n") if "error TS" in l][:10]
            self.report.add(AuditResult(
                "FRONTEND", "FAIL" if errors else "WARN",
                f"TypeScript issues: {len(errors)}",
                errors
            ))
        else:
            self.report.add(AuditResult("FRONTEND", "PASS", "TypeScript compilation OK"))

    def audit_frontend_api_calls(self):
        """Check frontend API calls match backend endpoints."""
        api_calls = []
        
        for tsx_file in self.frontend.rglob("*.tsx"):
            if "node_modules" in str(tsx_file):
                continue
            try:
                content = tsx_file.read_text()
                # Find fetch/apiGet/apiPost calls
                calls = re.findall(r'(?:fetch|apiGet|apiPost|apiPut|apiDelete)\s*[<(]\s*[`"\']([^`"\']+)[`"\']', content)
                for call in calls:
                    api_calls.append({
                        "file": tsx_file.name,
                        "path": call.replace("${API_BASE}", "").replace("$", "")
                    })
            except:
                pass

        if api_calls:
            self.report.add(AuditResult(
                "FRONTEND", "PASS",
                f"Found {len(api_calls)} API calls",
                [f"{c['path']} ({c['file']})" for c in api_calls[:10]]
            ))
        
        return api_calls

    def audit_frontend_pages(self):
        """Check all pages have required exports."""
        pages_dir = self.frontend / "app"
        pages = []
        issues = []
        
        for page_file in pages_dir.rglob("page.tsx"):
            rel_path = page_file.relative_to(pages_dir)
            route = "/" + str(rel_path.parent).replace("\\", "/")
            if route == "/.":
                route = "/"
            
            content = page_file.read_text()
            has_default_export = "export default" in content
            
            if not has_default_export:
                issues.append(f"{route}: missing default export")
            else:
                pages.append(route)

        if issues:
            self.report.add(AuditResult(
                "FRONTEND", "FAIL",
                f"Page issues: {len(issues)}",
                issues
            ))
        else:
            self.report.add(AuditResult(
                "FRONTEND", "PASS",
                f"Found {len(pages)} valid pages",
                pages[:10]
            ))

    # =========================================================================
    # 5. CONTRACT VALIDATION (Endpoint → Type → Component)
    # =========================================================================
    def audit_contracts(self):
        """Validate endpoint → type → component contracts."""
        # Extract backend response models
        models_dir = self.backend / "models"
        backend_types = {}
        
        for model_file in models_dir.glob("*.py"):
            if model_file.name == "__init__.py":
                continue
            content = model_file.read_text()
            classes = re.findall(r"class\s+(\w+)\s*\(", content)
            for cls in classes:
                backend_types[cls] = model_file.name

        # Extract frontend types
        frontend_types = {}
        for tsx_file in self.frontend.rglob("*.tsx"):
            if "node_modules" in str(tsx_file):
                continue
            try:
                content = tsx_file.read_text()
                # Match both "type X = {" and "interface X {"
                types = re.findall(r"(?:type|interface)\s+(\w+)\s*(?:=\s*)?\{", content)
                for t in types:
                    frontend_types[t] = tsx_file.name
            except:
                pass

        # Check for common entity alignment
        entities = ["Job", "Lead", "Homeowner", "Installer", "Supplier", "Quote", "File"]
        aligned = []
        misaligned = []
        
        for entity in entities:
            in_backend = entity in backend_types or f"{entity}Base" in backend_types
            in_frontend = entity in frontend_types
            
            if in_backend and in_frontend:
                aligned.append(entity)
            elif in_backend or in_frontend:
                misaligned.append(f"{entity}: backend={in_backend}, frontend={in_frontend}")

        if misaligned:
            self.report.add(AuditResult(
                "CONTRACT", "WARN",
                f"Type alignment issues: {len(misaligned)}",
                misaligned
            ))
        else:
            self.report.add(AuditResult(
                "CONTRACT", "PASS",
                f"Entity types aligned: {len(aligned)}",
                aligned
            ))

    # =========================================================================
    # 6. GITIGNORE VALIDATION
    # =========================================================================
    def audit_gitignore(self):
        """Ensure sensitive files are gitignored."""
        gitignore = self.root / ".gitignore"
        required_patterns = [".env", ".env.local", "node_modules", "__pycache__"]
        
        if not gitignore.exists():
            self.report.add(AuditResult(
                "SECURITY", "FAIL",
                ".gitignore missing"
            ))
            return

        content = gitignore.read_text()
        missing = [p for p in required_patterns if p not in content]
        
        if missing:
            self.report.add(AuditResult(
                "SECURITY", "FAIL",
                f"Missing gitignore patterns: {', '.join(missing)}"
            ))
        else:
            self.report.add(AuditResult("SECURITY", "PASS", ".gitignore configured correctly"))

    # =========================================================================
    # MAIN AUDIT RUNNER
    # =========================================================================
    async def run_full_audit(self):
        """Execute complete recursive audit."""
        print("\n🔄 AEON Recursive Self-Audit Engine Starting...")
        print("-" * 60)

        # 1. Environment
        print("📋 Auditing environment variables...")
        self.audit_environment()

        # 2. Security
        print("🔒 Auditing security configuration...")
        self.audit_gitignore()

        # 3. Backend
        print("⚙️  Auditing backend...")
        self.audit_backend_syntax()
        self.audit_backend_imports()
        self.audit_backend_routers()

        # 4. Database
        print("🗄️  Auditing database...")
        await self.audit_database()

        # 5. Frontend
        print("🎨 Auditing frontend...")
        self.audit_frontend_pages()
        self.audit_frontend_api_calls()
        # Skip TypeScript check if node_modules not installed
        if (self.frontend / "node_modules").exists():
            self.audit_frontend_typescript()
        else:
            self.report.add(AuditResult("FRONTEND", "WARN", "node_modules not installed, skipping TS check"))

        # 6. Contracts
        print("📝 Auditing contracts...")
        self.audit_contracts()

        # Print report
        return self.report.print_report()


async def main():
    project_root = Path(__file__).parent.parent.parent
    engine = AEONAuditEngine(project_root)
    success = await engine.run_full_audit()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
