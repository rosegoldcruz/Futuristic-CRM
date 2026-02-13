"use client"

import { useEffect, useState } from "react"
import { Zap, CheckCircle, XCircle, Clock, Play, Pause, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"

type Automation = {
  id: number
  automation_name: string
  automation_type: string
  trigger_event: string
  status: string
  enabled: boolean
  run_count: number
  success_count: number
  failure_count: number
  last_run_at?: string | null
  created_at?: string | null
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  paused: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50",
  disabled: "bg-slate-500/20 text-slate-300 border-slate-500/50",
  error: "bg-red-600/20 text-red-400 border-red-600/50",
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [typeFilter, setTypeFilter] = useState<string>("")

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    totalRuns: 0,
    successRate: 0,
  })

  async function loadAutomations() {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      if (typeFilter) params.set("automation_type", typeFilter)
      params.set("limit", "100")

      const res = await fetch(`${API_BASE}/automations/?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`Failed to load automations (${res.status})`)
      const data: Automation[] = await res.json()
      setAutomations(data)

      // Calculate stats
      const total = data.length
      const active = data.filter((a) => a.status === "active" && a.enabled).length
      const totalRuns = data.reduce((sum, a) => sum + a.run_count, 0)
      const totalSuccess = data.reduce((sum, a) => sum + a.success_count, 0)
      const successRate = totalRuns > 0 ? (totalSuccess / totalRuns) * 100 : 0

      setStats({ total, active, totalRuns, successRate })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load automations"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function toggleAutomation(id: number, currentlyEnabled: boolean) {
    try {
      const res = await fetch(`${API_BASE}/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentlyEnabled }),
      })

      if (!res.ok) throw new Error("Failed to update automation")
      await loadAutomations()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update"
      alert(message)
    }
  }

  useEffect(() => {
    loadAutomations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Automations & Workflows</h1>
          <p className="text-sm text-neutral-400">Cron tasks and event-triggered automations</p>
        </div>
        <Button className="bg-amber-600 hover:bg-amber-700 text-white">
          <Zap className="w-4 h-4 mr-2" />
          New Automation
        </Button>
      </header>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <Zap className="h-8 w-8 text-amber-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-neutral-400">Total Automations</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.active}</p>
              <p className="text-xs text-neutral-400">Active</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-blue-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.totalRuns.toLocaleString()}</p>
              <p className="text-xs text-neutral-400">Total Runs</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-purple-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.successRate.toFixed(1)}%</p>
              <p className="text-xs text-neutral-400">Success Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full md:w-48 rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="disabled">Disabled</option>
          <option value="error">Error</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-full md:w-48 rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
        >
          <option value="">All types</option>
          <option value="trigger">Trigger</option>
          <option value="scheduled">Scheduled</option>
          <option value="webhook">Webhook</option>
        </select>

        <Button
          variant="outline"
          size="sm"
          onClick={loadAutomations}
          disabled={loading}
          className="border-neutral-700 text-neutral-200 hover:bg-neutral-800 md:ml-auto"
        >
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Automations Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-neutral-800 bg-neutral-950/70">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900/80 border-b border-neutral-800 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Name</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Type</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Trigger</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Status</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Runs</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Success</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Last Run</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {automations.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-neutral-500 text-sm">
                  No automations configured
                </td>
              </tr>
            )}

            {automations.map((automation) => (
              <tr
                key={automation.id}
                className="border-t border-neutral-900 hover:bg-neutral-900/60 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {automation.enabled ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Pause className="w-4 h-4 text-neutral-500" />
                    )}
                    <span className="text-white font-medium">{automation.automation_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-neutral-400 capitalize text-xs">
                  {automation.automation_type}
                </td>
                <td className="px-4 py-3 text-neutral-400 text-xs">
                  {automation.trigger_event.replace(/_/g, " ")}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
                      STATUS_COLORS[automation.status] || STATUS_COLORS.active
                    }`}
                  >
                    {automation.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-300">{automation.run_count}</td>
                <td className="px-4 py-3">
                  <div className="text-xs">
                    <span className="text-emerald-400">{automation.success_count}</span>
                    {automation.failure_count > 0 && (
                      <>
                        {" / "}
                        <span className="text-red-400">{automation.failure_count}</span>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-neutral-400 text-xs">
                  {automation.last_run_at
                    ? new Date(automation.last_run_at).toLocaleString()
                    : "Never"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleAutomation(automation.id, automation.enabled)}
                    className={`text-xs ${
                      automation.enabled
                        ? "text-yellow-400 hover:text-yellow-200"
                        : "text-emerald-400 hover:text-emerald-200"
                    }`}
                  >
                    {automation.enabled ? (
                      <>
                        <Pause className="w-3 h-3 mr-1" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 mr-1" />
                        Enable
                      </>
                    )}
                  </Button>
                </td>
              </tr>
            ))}

            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-neutral-500 text-sm">
                  Loading automations…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
