# Filepath: /srv/vulpine-os/backend/main.py

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.db import init_db, close_db
from routers import (
    workflow, leads, homeowners, installers, suppliers, products, quotes, jobs, files, work_orders, intake, auth, payments, documents, ar_visualizer, marketing, metrics, automations, webhooks, supplier_orders, installer_workflow, homeowner_portal, landing_pages, notifications, metrics_engine, settings, orchestrator, performance, security, billing, superadmin
)
from middleware.performance_middleware import PerformanceMiddleware
from middleware.security_middleware import SecurityMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown
    await close_db()


app = FastAPI(title="Vulpine OS Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add security middleware (must be before performance)
app.add_middleware(SecurityMiddleware)

# Add performance tracking middleware
app.add_middleware(PerformanceMiddleware)

# Register routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])  # Auth endpoints (public)
app.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])  # Webhooks (public)
app.include_router(homeowner_portal.router, prefix="/portal", tags=["homeowner_portal"])  # Portal (public)
app.include_router(leads.router, prefix="/leads", tags=["leads"])
app.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
app.include_router(homeowners.router, prefix="/homeowners", tags=["homeowners"])
app.include_router(suppliers.router, prefix="/suppliers", tags=["suppliers"])
app.include_router(supplier_orders.router, prefix="/supplier-orders", tags=["supplier_orders"])
app.include_router(quotes.router, prefix="/quotes", tags=["quotes"])
app.include_router(files.router, prefix="/files", tags=["files"])
app.include_router(installers.router, prefix="/installers", tags=["installers"])
app.include_router(work_orders.router, prefix="/work-orders", tags=["work_orders"])
app.include_router(installer_workflow.router, prefix="/installer", tags=["installer_workflow"])
app.include_router(payments.router, prefix="/payments", tags=["payments"])
app.include_router(documents.router, prefix="/documents", tags=["documents"])
app.include_router(ar_visualizer.router, prefix="/visualizer", tags=["ar_visualizer"])
app.include_router(marketing.router, prefix="/marketing", tags=["marketing"])
app.include_router(landing_pages.router, prefix="/landing-pages", tags=["landing_pages"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(metrics.router, prefix="/metrics", tags=["metrics"])
app.include_router(metrics_engine.router, prefix="/metrics-engine", tags=["metrics_engine"])
app.include_router(settings.router, prefix="/settings", tags=["settings"])
app.include_router(orchestrator.router, prefix="/orchestrator", tags=["orchestrator"])
app.include_router(performance.router, prefix="/performance", tags=["performance"])
app.include_router(security.router, prefix="/security", tags=["security"])
app.include_router(billing.router, prefix="/billing", tags=["billing"])
app.include_router(superadmin.router, prefix="/superadmin", tags=["superadmin"])
app.include_router(automations.router, prefix="/automations", tags=["automations"])
app.include_router(intake.router)  # /intake/homeowner
app.include_router(workflow.router)  # /workflow/*
app.include_router(products.router, prefix="/products", tags=["products"])


@app.get("/")
async def root():
    return {"status": "Vulpine OS backend online", "database": "PostgreSQL/Supabase"}
