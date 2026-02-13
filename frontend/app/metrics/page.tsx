"use client"

import { useEffect, useState } from "react"
import {
  TrendingUp,
  Users,
  DollarSign,
  Briefcase,
  Target,
  Award,
  Clock,
  CheckCircle,
  BarChart3,
  Activity,
} from "lucide-react"
import { Button } from "@/components/ui/button"

type OverviewMetrics = {
  total_leads: number
  total_quotes: number
  total_jobs: number
  total_work_orders: number
  total_payments: number
  active_jobs: number
  pending_quotes: number
  revenue_month: number
  revenue_total: number
  conversion_rate: number
  avg_quote_value: number
}

type JobMetrics = {
  total_jobs: number
  pending_jobs: number
  in_progress_jobs: number
  completed_jobs: number
  cancelled_jobs: number
  jobs_by_status: Array<{ status: string; count: number }>
  jobs_by_installer: Array<{ installer: string; job_count: number; completed: number }>
  jobs_timeline: Array<{ date: string; count: number; status: string }>
}

type RevenueMetrics = {
  total_revenue: number
  revenue_this_month: number
  revenue_this_quarter: number
  revenue_this_year: number
  total_quotes_value: number
  approved_quotes_value: number
  pending_quotes_value: number
  avg_quote_value: number
  revenue_timeline: Array<{ month: string; revenue: number; quote_count: number }>
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

export default function MetricsPage() {
  const [overview, setOverview] = useState<OverviewMetrics | null>(null)
  const [jobs, setJobs] = useState<JobMetrics | null>(null)
  const [revenue, setRevenue] = useState<RevenueMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  async function loadMetrics() {
    try {
      setLoading(true)
      setError(null)

      const [overviewRes, jobsRes, revenueRes] = await Promise.all([
        fetch(`${API_BASE}/metrics/overview`, { cache: "no-store" }),
        fetch(`${API_BASE}/metrics/jobs`, { cache: "no-store" }),
        fetch(`${API_BASE}/metrics/revenue`, { cache: "no-store" }),
      ])

      if (!overviewRes.ok || !jobsRes.ok || !revenueRes.ok) {
        throw new Error("Failed to load metrics")
      }

      const [overviewData, jobsData, revenueData] = await Promise.all([
        overviewRes.json(),
        jobsRes.json(),
        revenueRes.json(),
      ])

      setOverview(overviewData)
      setJobs(jobsData)
      setRevenue(revenueData)
      setLastUpdated(new Date())
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load metrics"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMetrics()
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadMetrics, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Activity className="w-12 h-12 mx-auto mb-3 text-amber-400 animate-pulse" />
          <p className="text-neutral-400">Loading real-time metrics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Real-Time Metrics</h1>
          <p className="text-sm text-neutral-400">
            System-wide analytics and performance dashboards
            {lastUpdated && (
              <span className="ml-2">
                • Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadMetrics}
          disabled={loading}
          className="border-neutral-700 text-neutral-200 hover:bg-neutral-800"
        >
          <Activity className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      {error && (
        <div className="rounded-md border border-red-500/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {overview && (
        <>
          {/* Key Metrics Grid */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-gradient-to-br from-blue-950/40 to-slate-900/50 p-4">
              <div className="flex items-center gap-3 mb-2">
                <Users className="h-8 w-8 text-blue-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{overview.total_leads.toLocaleString()}</p>
                  <p className="text-xs text-neutral-400">Total Leads</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-neutral-500">
                {overview.pending_quotes} pending quotes
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-gradient-to-br from-purple-950/40 to-slate-900/50 p-4">
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 className="h-8 w-8 text-purple-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{overview.total_quotes.toLocaleString()}</p>
                  <p className="text-xs text-neutral-400">Total Quotes</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-neutral-500">
                ${overview.avg_quote_value.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })} avg value
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-gradient-to-br from-emerald-950/40 to-slate-900/50 p-4">
              <div className="flex items-center gap-3 mb-2">
                <Briefcase className="h-8 w-8 text-emerald-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{overview.total_jobs.toLocaleString()}</p>
                  <p className="text-xs text-neutral-400">Total Jobs</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-neutral-500">
                {overview.active_jobs} active
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-gradient-to-br from-amber-950/40 to-slate-900/50 p-4">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="h-8 w-8 text-amber-400" />
                <div>
                  <p className="text-2xl font-bold text-white">
                    ${overview.revenue_total.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </p>
                  <p className="text-xs text-neutral-400">Total Revenue</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-neutral-500">
                ${overview.revenue_month.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })} this month
              </div>
            </div>
          </div>

          {/* Secondary Metrics */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-400 mb-1">Conversion Rate</p>
                  <p className="text-3xl font-bold text-white">{overview.conversion_rate.toFixed(1)}%</p>
                </div>
                <Target className="h-10 w-10 text-purple-400 opacity-50" />
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-400 mb-1">Work Orders</p>
                  <p className="text-3xl font-bold text-white">{overview.total_work_orders}</p>
                </div>
                <Award className="h-10 w-10 text-blue-400 opacity-50" />
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-400 mb-1">Payments</p>
                  <p className="text-3xl font-bold text-white">{overview.total_payments}</p>
                </div>
                <CheckCircle className="h-10 w-10 text-emerald-400 opacity-50" />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Jobs Metrics */}
      {jobs && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-emerald-400" />
              Jobs by Status
            </h2>
            <div className="space-y-3">
              {jobs.jobs_by_status.slice(0, 5).map((item, idx) => {
                const maxCount = jobs.jobs_by_status[0]?.count || 1
                const percentage = (item.count / maxCount) * 100
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="text-neutral-300 capitalize">{item.status.replace(/_/g, " ")}</span>
                      <span className="text-neutral-400">{item.count}</span>
                    </div>
                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Top Installers
            </h2>
            {jobs.jobs_by_installer.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-8">No installer data</p>
            ) : (
              <div className="space-y-3">
                {jobs.jobs_by_installer.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded bg-neutral-900/40">
                    <div>
                      <p className="text-sm text-neutral-300">{item.installer}</p>
                      <p className="text-xs text-neutral-500">{item.completed} completed</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">{item.job_count} jobs</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Revenue Timeline */}
      {revenue && revenue.revenue_timeline.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            Revenue Timeline (Last 12 Months)
          </h2>
          <div className="overflow-x-auto">
            <div className="inline-flex flex-col space-y-2 min-w-full">
              {revenue.revenue_timeline.slice(0, 12).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 p-3 rounded bg-neutral-900/40 hover:bg-neutral-900/60 transition"
                >
                  <div className="text-sm text-neutral-400 w-32">
                    {item.month ? new Date(item.month).toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    }) : "Unknown"}
                  </div>
                  <div className="flex-1">
                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-600"
                        style={{
                          width: `${Math.min((item.revenue / (revenue.revenue_timeline[0]?.revenue || 1)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-sm font-medium text-white w-32 text-right">
                    ${item.revenue.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </div>
                  <div className="text-xs text-neutral-500 w-20 text-right">
                    {item.quote_count} quotes
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
