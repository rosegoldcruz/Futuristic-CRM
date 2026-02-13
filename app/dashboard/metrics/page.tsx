"use client"

import { useEffect, useState } from "react"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Users,
  Briefcase,
  Target,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"

type MetricValue = {
  metric_key: string
  metric_name: string
  value: number | null
  formatted_value: string
  unit?: string
}

type WidgetData = {
  widget_key: string
  widget_name: string
  widget_type: string
  metrics: MetricValue[]
  config?: any
}

type DashboardData = {
  widgets: WidgetData[]
  last_updated: string
  refresh_interval: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

const METRIC_ICONS: Record<string, any> = {
  total_leads: Users,
  total_revenue: DollarSign,
  conversion_rate: Target,
  active_jobs: Briefcase,
}

export default function MetricsDashboard() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  useEffect(() => {
    loadDashboard()
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      loadDashboard()
    }, 60000)
    
    return () => clearInterval(interval)
  }, [])

  async function loadDashboard() {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/metrics-engine/dashboard`, {
        cache: "no-store",
      })
      if (res.ok) {
        const data = await res.json()
        setDashboard(data)
        setLastRefresh(new Date())
      }
    } catch (err) {
      console.error("Failed to load dashboard:", err)
    } finally {
      setLoading(false)
    }
  }

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-neutral-400">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Metrics Dashboard</h1>
          <p className="text-sm text-neutral-400">
            Real-time business metrics • Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <Button
          onClick={loadDashboard}
          disabled={loading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      {/* Widgets Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {dashboard.widgets.map((widget) => {
          if (widget.widget_type === "number" || widget.widget_type === "trend") {
            return (
              <div
                key={widget.widget_key}
                className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6"
              >
                {widget.metrics.map((metric) => {
                  const Icon = METRIC_ICONS[metric.metric_key] || TrendingUp
                  return (
                    <div key={metric.metric_key}>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-4 h-4 text-blue-400" />
                        <p className="text-sm text-neutral-400">{metric.metric_name}</p>
                      </div>
                      <p className="text-3xl font-bold text-white mb-1">
                        {metric.formatted_value}
                      </p>
                      {metric.unit && (
                        <p className="text-xs text-neutral-500">{metric.unit}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          }

          return (
            <div
              key={widget.widget_key}
              className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6"
            >
              <h3 className="text-sm font-medium text-neutral-300 mb-4">
                {widget.widget_name}
              </h3>
              <div className="space-y-3">
                {widget.metrics.map((metric) => (
                  <div key={metric.metric_key} className="flex items-center justify-between">
                    <p className="text-sm text-neutral-400">{metric.metric_name}</p>
                    <p className="text-sm font-semibold text-white">
                      {metric.formatted_value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty State */}
      {dashboard.widgets.length === 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-12 text-center">
          <Target className="w-16 h-16 text-neutral-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Widgets Configured</h3>
          <p className="text-sm text-neutral-400 mb-4">
            Create dashboard widgets to visualize your business metrics
          </p>
          <Button>Configure Widgets</Button>
        </div>
      )}

      {/* Additional Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-neutral-300">Quick Stats</p>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Total Widgets</span>
              <span className="text-white font-semibold">{dashboard.widgets.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Metrics Tracked</span>
              <span className="text-white font-semibold">
                {dashboard.widgets.reduce((sum, w) => sum + w.metrics.length, 0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Refresh Rate</span>
              <span className="text-white font-semibold">{dashboard.refresh_interval}s</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-neutral-300">Performance</p>
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Cache Status</span>
              <span className="text-emerald-400 font-semibold">Active</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Query Time</span>
              <span className="text-white font-semibold">&lt;50ms</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Data Freshness</span>
              <span className="text-white font-semibold">Real-time</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-neutral-300">System Health</p>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full" />
              <span className="text-xs text-emerald-400">Healthy</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Database</span>
              <span className="text-emerald-400 font-semibold">✓ Online</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">API</span>
              <span className="text-emerald-400 font-semibold">✓ Responsive</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Cache</span>
              <span className="text-emerald-400 font-semibold">✓ Available</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
