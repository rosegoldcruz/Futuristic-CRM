"use client"

import { useEffect, useState } from "react"
import { Activity, Zap, Database, Server, TrendingUp, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"

type PerformanceMetrics = {
  avg_response_time_ms: number
  p50_response_time_ms: number
  p95_response_time_ms: number
  p99_response_time_ms: number
  total_requests: number
  slow_requests: number
  slow_percentage: number
  requests_per_second: number
  cache_hit_rate: number
}

type CacheStats = {
  total_entries: number
  total_hits: number
  hit_rate: number
  avg_hit_count: number
  expired_count: number
  size_bytes: number
}

type SlowEndpoint = {
  path: string
  method: string
  avg_response_time_ms: number
  max_response_time_ms: number
  request_count: number
  slow_count: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

export default function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
  const [slowEndpoints, setSlowEndpoints] = useState<SlowEndpoint[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadPerformance()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadPerformance, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadPerformance() {
    try {
      setLoading(true)

      // Load metrics
      const metricsRes = await fetch(`${API_BASE}/performance/metrics?hours=24`)
      if (metricsRes.ok) {
        const data = await metricsRes.json()
        setMetrics(data)
      }

      // Load cache stats
      const cacheRes = await fetch(`${API_BASE}/performance/cache/stats`)
      if (cacheRes.ok) {
        const data = await cacheRes.json()
        setCacheStats(data)
      }

      // Load slow endpoints
      const slowRes = await fetch(`${API_BASE}/performance/slow-endpoints?limit=5`)
      if (slowRes.ok) {
        const data = await slowRes.json()
        setSlowEndpoints(data)
      }
    } catch (err) {
      console.error("Failed to load performance:", err)
    } finally {
      setLoading(false)
    }
  }

  async function refreshMaterializedViews() {
    try {
      const res = await fetch(`${API_BASE}/performance/materialized-views/refresh`, {
        method: "POST",
      })
      if (res.ok) {
        alert("Materialized views refreshed!")
      }
    } catch (err) {
      console.error("Failed to refresh:", err)
    }
  }

  async function clearCache() {
    try {
      const res = await fetch(`${API_BASE}/performance/cache/clear`, {
        method: "POST",
      })
      if (res.ok) {
        alert("Cache cleared!")
        await loadPerformance()
      }
    } catch (err) {
      console.error("Failed to clear cache:", err)
    }
  }

  if (!metrics || !cacheStats) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-neutral-400">Loading performance data...</p>
      </div>
    )
  }

  const isHealthy = metrics.avg_response_time_ms < 120 && metrics.slow_percentage < 5

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-400" />
            Performance Dashboard
          </h1>
          <p className="text-sm text-neutral-400">
            System performance monitoring • Last 24 hours
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadPerformance} disabled={loading} variant="outline" size="sm">
            Refresh
          </Button>
          <Button onClick={clearCache} variant="outline" size="sm">
            Clear Cache
          </Button>
          <Button onClick={refreshMaterializedViews} variant="outline" size="sm">
            Refresh Views
          </Button>
        </div>
      </header>

      {/* Status Banner */}
      <div
        className={`rounded-lg border p-4 ${
          isHealthy
            ? "bg-emerald-950/20 border-emerald-900/50"
            : "bg-amber-950/20 border-amber-900/50"
        }`}
      >
        <div className="flex items-center gap-3">
          <Zap className={`w-5 h-5 ${isHealthy ? "text-emerald-400" : "text-amber-400"}`} />
          <div>
            <p className={`font-medium ${isHealthy ? "text-emerald-300" : "text-amber-300"}`}>
              {isHealthy ? "System Healthy" : "System Degraded"}
            </p>
            <p className="text-sm text-neutral-400">
              {isHealthy
                ? "All performance metrics within acceptable range"
                : "Some endpoints are responding slowly"}
            </p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <p className="text-sm text-neutral-400">Avg Response</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {metrics.avg_response_time_ms.toFixed(1)}ms
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            P95: {metrics.p95_response_time_ms.toFixed(1)}ms
          </p>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <p className="text-sm text-neutral-400">Total Requests</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {metrics.total_requests.toLocaleString()}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            {metrics.requests_per_second.toFixed(2)} req/s
          </p>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Server className="w-4 h-4 text-amber-400" />
            <p className="text-sm text-neutral-400">Slow Requests</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {metrics.slow_requests}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            {metrics.slow_percentage.toFixed(1)}% of total
          </p>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-purple-400" />
            <p className="text-sm text-neutral-400">Cache Hit Rate</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {cacheStats.hit_rate.toFixed(1)}%
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            {cacheStats.total_entries} entries
          </p>
        </div>
      </div>

      {/* Percentiles */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
        <h3 className="text-sm font-medium text-white mb-4">Response Time Percentiles</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-neutral-500">P50 (Median)</p>
            <p className="text-xl font-semibold text-white mt-1">
              {metrics.p50_response_time_ms.toFixed(1)}ms
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">P95</p>
            <p className="text-xl font-semibold text-white mt-1">
              {metrics.p95_response_time_ms.toFixed(1)}ms
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">P99</p>
            <p className="text-xl font-semibold text-white mt-1">
              {metrics.p99_response_time_ms.toFixed(1)}ms
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Average</p>
            <p className="text-xl font-semibold text-white mt-1">
              {metrics.avg_response_time_ms.toFixed(1)}ms
            </p>
          </div>
        </div>
      </div>

      {/* Slow Endpoints */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
        <h3 className="text-sm font-medium text-white mb-4">Slowest Endpoints</h3>
        <div className="space-y-2">
          {slowEndpoints.map((endpoint, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded bg-neutral-950 border border-neutral-800"
            >
              <div>
                <p className="text-sm text-white">
                  <span className="font-mono text-xs text-blue-400">{endpoint.method}</span>{" "}
                  {endpoint.path}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  {endpoint.request_count} requests • {endpoint.slow_count} slow
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-white">
                  {endpoint.avg_response_time_ms.toFixed(1)}ms
                </p>
                <p className="text-xs text-neutral-500">
                  max: {endpoint.max_response_time_ms.toFixed(1)}ms
                </p>
              </div>
            </div>
          ))}
          {slowEndpoints.length === 0 && (
            <p className="text-center text-neutral-500 py-4 text-sm">
              No slow endpoints detected
            </p>
          )}
        </div>
      </div>

      {/* Cache Stats */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
        <h3 className="text-sm font-medium text-white mb-4">Cache Statistics</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-neutral-500">Total Entries</p>
            <p className="text-xl font-semibold text-white mt-1">
              {cacheStats.total_entries}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Total Hits</p>
            <p className="text-xl font-semibold text-white mt-1">
              {cacheStats.total_hits}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Cache Size</p>
            <p className="text-xl font-semibold text-white mt-1">
              {(cacheStats.size_bytes / 1024).toFixed(1)}KB
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
