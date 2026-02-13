"use client"

import { useEffect, useState } from "react"
import {
  Shield,
  Users,
  Building,
  AlertCircle,
  Activity,
  TrendingUp,
  PlayCircle,
  PauseCircle,
  Trash2,
  Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"

type Tenant = {
  id: number
  tenant_id: number
  name: string
  status: string
  subscription_tier: string
  user_count: number
  job_count: number
  mrr: number
  domain: string
  created_at: string
}

type GlobalMetrics = {
  total_tenants: number
  active_tenants: number
  suspended_tenants: number
  total_users: number
  total_jobs: number
  mrr: number
  errors_24h: number
  critical_errors: number
}

type SystemError = {
  id: number
  error_type: string
  error_message: string
  severity: string
  tenant_id: number
  resolved: boolean
  created_at: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

export default function SuperadminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [metrics, setMetrics] = useState<GlobalMetrics | null>(null)
  const [errors, setErrors] = useState<SystemError[]>([])
  const [activeTab, setActiveTab] = useState<"tenants" | "metrics" | "errors" | "logs">("tenants")
  const [loading, setLoading] = useState(true)

  // Mock superadmin ID - in production, get from auth
  const superadminId = 1

  useEffect(() => {
    loadData()
  }, [activeTab])

  async function loadData() {
    setLoading(true)
    try {
      if (activeTab === "tenants") {
        await loadTenants()
      } else if (activeTab === "metrics") {
        await loadMetrics()
      } else if (activeTab === "errors") {
        await loadErrors()
      }
    } catch (err) {
      console.error("Failed to load data:", err)
    } finally {
      setLoading(false)
    }
  }

  async function loadTenants() {
    const res = await fetch(`${API_BASE}/superadmin/tenants?user_id=${superadminId}`)
    if (res.ok) {
      const data = await res.json()
      setTenants(data)
    }
  }

  async function loadMetrics() {
    const res = await fetch(`${API_BASE}/superadmin/metrics/global?user_id=${superadminId}`)
    if (res.ok) {
      const data = await res.json()
      setMetrics(data)
    }
  }

  async function loadErrors() {
    const res = await fetch(`${API_BASE}/superadmin/errors?user_id=${superadminId}&resolved=false`)
    if (res.ok) {
      const data = await res.json()
      setErrors(data)
    }
  }

  async function suspendTenant(tenantId: number) {
    if (!confirm("Are you sure you want to suspend this tenant?")) return

    const res = await fetch(
      `${API_BASE}/superadmin/tenants/${tenantId}/suspend?user_id=${superadminId}`,
      { method: "POST" }
    )

    if (res.ok) {
      alert("Tenant suspended")
      await loadTenants()
    }
  }

  async function activateTenant(tenantId: number) {
    const res = await fetch(
      `${API_BASE}/superadmin/tenants/${tenantId}/activate?user_id=${superadminId}`,
      { method: "POST" }
    )

    if (res.ok) {
      alert("Tenant activated")
      await loadTenants()
    }
  }

  async function resolveError(errorId: number) {
    const res = await fetch(
      `${API_BASE}/superadmin/errors/${errorId}/resolve?user_id=${superadminId}`,
      { method: "POST" }
    )

    if (res.ok) {
      await loadErrors()
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-red-400" />
          Superadmin Panel
        </h1>
        <p className="text-sm text-neutral-400">
          Multi-tenant management and system control
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-800">
        <button
          onClick={() => setActiveTab("tenants")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === "tenants"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-neutral-400 hover:text-white"
          }`}
        >
          <Building className="w-4 h-4 inline mr-2" />
          Tenants
        </button>
        <button
          onClick={() => setActiveTab("metrics")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === "metrics"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-neutral-400 hover:text-white"
          }`}
        >
          <TrendingUp className="w-4 h-4 inline mr-2" />
          Global Metrics
        </button>
        <button
          onClick={() => setActiveTab("errors")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === "errors"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-neutral-400 hover:text-white"
          }`}
        >
          <AlertCircle className="w-4 h-4 inline mr-2" />
          System Errors
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === "logs"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-neutral-400 hover:text-white"
          }`}
        >
          <Activity className="w-4 h-4 inline mr-2" />
          System Logs
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <p className="text-center text-neutral-400 py-12">Loading...</p>
      ) : (
        <>
          {/* Tenants Tab */}
          {activeTab === "tenants" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">
                  All Tenants ({tenants.length})
                </h2>
                <Button size="sm">Create Tenant</Button>
              </div>

              <div className="space-y-2">
                {tenants.map((tenant) => (
                  <div
                    key={tenant.id}
                    className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{tenant.name}</h3>
                        <p className="text-xs text-neutral-500">
                          ID: {tenant.tenant_id} • {tenant.domain || "No domain"}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-neutral-500">Status</p>
                          <p
                            className={`text-sm font-medium ${
                              tenant.status === "active"
                                ? "text-emerald-400"
                                : tenant.status === "suspended"
                                ? "text-red-400"
                                : "text-amber-400"
                            }`}
                          >
                            {tenant.status}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xs text-neutral-500">Tier</p>
                          <p className="text-sm font-medium text-white capitalize">
                            {tenant.subscription_tier}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xs text-neutral-500">Users</p>
                          <p className="text-sm font-medium text-white">
                            {tenant.user_count}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xs text-neutral-500">Jobs</p>
                          <p className="text-sm font-medium text-white">
                            {tenant.job_count}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xs text-neutral-500">MRR</p>
                          <p className="text-sm font-medium text-emerald-400">
                            ${tenant.mrr?.toFixed(0)}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4" />
                          </Button>
                          {tenant.status === "active" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => suspendTenant(tenant.tenant_id)}
                            >
                              <PauseCircle className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => activateTenant(tenant.tenant_id)}
                            >
                              <PlayCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metrics Tab */}
          {activeTab === "metrics" && metrics && (
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                <Building className="w-5 h-5 text-blue-400 mb-2" />
                <p className="text-2xl font-bold text-white">{metrics.total_tenants}</p>
                <p className="text-xs text-neutral-500">Total Tenants</p>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                <Users className="w-5 h-5 text-emerald-400 mb-2" />
                <p className="text-2xl font-bold text-white">{metrics.total_users}</p>
                <p className="text-xs text-neutral-500">Total Users</p>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                <TrendingUp className="w-5 h-5 text-purple-400 mb-2" />
                <p className="text-2xl font-bold text-white">
                  ${metrics.mrr.toFixed(0)}
                </p>
                <p className="text-xs text-neutral-500">Monthly Recurring Revenue</p>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                <AlertCircle className="w-5 h-5 text-red-400 mb-2" />
                <p className="text-2xl font-bold text-white">{metrics.critical_errors}</p>
                <p className="text-xs text-neutral-500">Critical Errors</p>
              </div>
            </div>
          )}

          {/* Errors Tab */}
          {activeTab === "errors" && (
            <div className="space-y-2">
              {errors.map((error) => (
                <div
                  key={error.id}
                  className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded ${
                            error.severity === "critical"
                              ? "bg-red-900/50 text-red-300"
                              : error.severity === "high"
                              ? "bg-orange-900/50 text-orange-300"
                              : "bg-amber-900/50 text-amber-300"
                          }`}
                        >
                          {error.severity}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {error.error_type}
                        </span>
                      </div>
                      <p className="text-sm text-white mb-1">
                        {error.error_message}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Tenant ID: {error.tenant_id} •{" "}
                        {new Date(error.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveError(error.id)}
                    >
                      Resolve
                    </Button>
                  </div>
                </div>
              ))}

              {errors.length === 0 && (
                <p className="text-center text-neutral-500 py-12">
                  No unresolved errors
                </p>
              )}
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === "logs" && (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
              <p className="text-center text-neutral-400">
                System logs will appear here
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
