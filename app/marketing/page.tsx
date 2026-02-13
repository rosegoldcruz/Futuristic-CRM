"use client"

import { useEffect, useState } from "react"
import { TrendingUp, Users, MousePointerClick, Target, BarChart3, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"

type MarketingMetrics = {
  total_events: number
  total_page_views: number
  total_leads: number
  total_conversions: number
  top_sources: Array<{ source: string; count: number }>
  top_campaigns: Array<{ campaign: string; count: number }>
  top_mediums: Array<{ medium: string; count: number }>
  timeline_data: Array<{ date: string; count: number; event_type: string }>
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

export default function MarketingPage() {
  const [metrics, setMetrics] = useState<MarketingMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<string>("30")

  async function loadMetrics() {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (dateRange !== "all") {
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - parseInt(dateRange))
        params.set("start_date", startDate.toISOString())
        params.set("end_date", endDate.toISOString())
      }

      const res = await fetch(`${API_BASE}/marketing/metrics?${params.toString()}`, {
        cache: "no-store",
      })
      if (!res.ok) throw new Error(`Failed to load metrics (${res.status})`)
      const data: MarketingMetrics = await res.json()
      setMetrics(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load metrics"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMetrics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange])

  function calculateConversionRate(): string {
    if (!metrics || metrics.total_page_views === 0) return "0"
    return ((metrics.total_leads / metrics.total_page_views) * 100).toFixed(2)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Marketing Analytics</h1>
          <p className="text-sm text-neutral-400">Track lead sources, UTM parameters, and campaign performance</p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </header>

      {error && (
        <div className="rounded-md border border-red-500/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-neutral-400">Loading metrics...</div>
      )}

      {metrics && (
        <>
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <div className="flex items-center gap-3">
                <MousePointerClick className="h-8 w-8 text-blue-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{metrics.total_events.toLocaleString()}</p>
                  <p className="text-xs text-neutral-400">Total Events</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-purple-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{metrics.total_page_views.toLocaleString()}</p>
                  <p className="text-xs text-neutral-400">Page Views</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-emerald-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{metrics.total_leads.toLocaleString()}</p>
                  <p className="text-xs text-neutral-400">Leads Created</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <div className="flex items-center gap-3">
                <Target className="h-8 w-8 text-amber-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{calculateConversionRate()}%</p>
                  <p className="text-xs text-neutral-400">Conversion Rate</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Top Sources */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                Top Sources
              </h2>
              {metrics.top_sources.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-8">No data available</p>
              ) : (
                <div className="space-y-3">
                  {metrics.top_sources.slice(0, 5).map((item, idx) => {
                    const maxCount = metrics.top_sources[0].count
                    const percentage = (item.count / maxCount) * 100
                    return (
                      <div key={idx}>
                        <div className="flex items-center justify-between mb-1 text-sm">
                          <span className="text-neutral-300 truncate">{item.source || "Direct"}</span>
                          <span className="text-neutral-400 ml-2">{item.count}</span>
                        </div>
                        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-600"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Top Campaigns */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-400" />
                Top Campaigns
              </h2>
              {metrics.top_campaigns.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-8">No campaigns tracked</p>
              ) : (
                <div className="space-y-3">
                  {metrics.top_campaigns.slice(0, 5).map((item, idx) => {
                    const maxCount = metrics.top_campaigns[0].count
                    const percentage = (item.count / maxCount) * 100
                    return (
                      <div key={idx}>
                        <div className="flex items-center justify-between mb-1 text-sm">
                          <span className="text-neutral-300 truncate">{item.campaign}</span>
                          <span className="text-neutral-400 ml-2">{item.count}</span>
                        </div>
                        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-purple-600"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Top Mediums */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                Top Mediums
              </h2>
              {metrics.top_mediums.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-8">No mediums tracked</p>
              ) : (
                <div className="space-y-3">
                  {metrics.top_mediums.slice(0, 5).map((item, idx) => {
                    const maxCount = metrics.top_mediums[0].count
                    const percentage = (item.count / maxCount) * 100
                    return (
                      <div key={idx}>
                        <div className="flex items-center justify-between mb-1 text-sm">
                          <span className="text-neutral-300 capitalize truncate">
                            {item.medium.replace(/_/g, " ")}
                          </span>
                          <span className="text-neutral-400 ml-2">{item.count}</span>
                        </div>
                        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Event Timeline */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              Recent Activity Timeline
            </h2>
            {metrics.timeline_data.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-8">No timeline data</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="inline-flex flex-col space-y-2 min-w-full">
                  {metrics.timeline_data.slice(0, 10).map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-4 p-3 rounded bg-neutral-900/40 hover:bg-neutral-900/60 transition"
                    >
                      <div className="text-sm text-neutral-400 w-24">
                        {item.date ? new Date(item.date).toLocaleDateString() : "Unknown"}
                      </div>
                      <div className="flex-1">
                        <span className="text-sm text-neutral-300 capitalize">
                          {item.event_type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-white">{item.count} events</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={loadMetrics}
              className="border-neutral-700 text-neutral-200 hover:bg-neutral-800"
            >
              Refresh Data
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
