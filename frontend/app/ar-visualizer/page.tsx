"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Eye, Image, Sparkles, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

type ARRender = {
  id: number
  homeowner_id?: number | null
  job_id?: number | null
  homeowner_name?: string | null
  job_customer_name?: string | null
  render_type: string
  before_image_url?: string | null
  after_image_url?: string | null
  render_status: string
  ar_session_id?: string | null
  panel_selection?: Record<string, unknown> | null
  thumbnail_url?: string | null
  processing_started_at?: string | null
  processing_completed_at?: string | null
  created_at?: string | null
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50",
  processing: "bg-blue-500/20 text-blue-300 border-blue-500/50",
  completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  failed: "bg-red-600/20 text-red-400 border-red-600/50",
  cancelled: "bg-slate-500/20 text-slate-300 border-slate-500/50",
}

export default function ARVisualizerPage() {
  const [renders, setRenders] = useState<ARRender[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [typeFilter, setTypeFilter] = useState<string>("")

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
  })

  async function loadRenders() {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (statusFilter) params.set("render_status", statusFilter)
      if (typeFilter) params.set("render_type", typeFilter)
      params.set("limit", "100")

      const res = await fetch(`${API_BASE}/visualizer/?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`Failed to load renders (${res.status})`)
      const data: ARRender[] = await res.json()
      setRenders(data)

      // Calculate stats
      const total = data.length
      const pending = data.filter((r) => r.render_status === "pending").length
      const processing = data.filter((r) => r.render_status === "processing").length
      const completed = data.filter((r) => r.render_status === "completed").length

      setStats({ total, pending, processing, completed })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load renders"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRenders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter])

  function getStatusIcon(status: string) {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4" />
      case "processing":
        return <RefreshCw className="w-4 h-4 animate-spin" />
      case "failed":
        return <XCircle className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">AR Visualizer</h1>
          <p className="text-sm text-neutral-400">Before/after rendering and AR sessions</p>
        </div>
        <Button className="bg-amber-600 hover:bg-amber-700 text-white">
          <Sparkles className="w-4 h-4 mr-2" />
          New Render
        </Button>
      </header>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <Image className="h-8 w-8 text-purple-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-neutral-400">Total Renders</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.pending}</p>
              <p className="text-xs text-neutral-400">Pending</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-8 w-8 text-blue-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.processing}</p>
              <p className="text-xs text-neutral-400">Processing</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.completed}</p>
              <p className="text-xs text-neutral-400">Completed</p>
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
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-full md:w-48 rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
        >
          <option value="">All types</option>
          <option value="before_after">Before/After</option>
          <option value="ar_overlay">AR Overlay</option>
          <option value="3d_model">3D Model</option>
          <option value="roof_analysis">Roof Analysis</option>
          <option value="panel_layout">Panel Layout</option>
        </select>

        <Button
          variant="outline"
          size="sm"
          onClick={loadRenders}
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

      {/* Timeline View */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Render Timeline</h2>

        {renders.length === 0 && !loading && (
          <div className="text-center py-12 text-neutral-500">
            <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No renders yet. Create your first AR visualization!</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-12 text-neutral-500">
            <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
            <p>Loading renders...</p>
          </div>
        )}

        <div className="space-y-4">
          {renders.map((render) => (
            <div
              key={render.id}
              className="flex flex-col md:flex-row gap-4 p-4 rounded-lg border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900/60 transition-colors"
            >
              {/* Thumbnail */}
              <div className="flex-shrink-0">
                <div className="w-full md:w-48 h-32 rounded-lg overflow-hidden bg-neutral-800 flex items-center justify-center">
                  {render.thumbnail_url || render.before_image_url ? (
                    <img
                      src={render.thumbnail_url || render.before_image_url || ""}
                      alt="Render thumbnail"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Image className="w-12 h-12 text-neutral-600" />
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <h3 className="text-white font-medium">
                      Render #{render.id}
                      {render.homeowner_name && (
                        <span className="text-neutral-400 ml-2">
                          - {render.homeowner_name}
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-neutral-400 capitalize">
                      {render.render_type.replace(/_/g, " ")}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                      STATUS_COLORS[render.render_status] || STATUS_COLORS.pending
                    }`}
                  >
                    {getStatusIcon(render.render_status)}
                    {render.render_status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-neutral-500 text-xs mb-0.5">Job</p>
                    <p className="text-neutral-300">
                      {render.job_id ? (
                        <Link href={`/jobs/${render.job_id}`} className="text-amber-400 hover:underline">
                          #{render.job_id}
                        </Link>
                      ) : (
                        "N/A"
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-neutral-500 text-xs mb-0.5">AR Session</p>
                    <p className="text-neutral-300 truncate">
                      {render.ar_session_id ? render.ar_session_id.slice(0, 12) + "..." : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-neutral-500 text-xs mb-0.5">Created</p>
                    <p className="text-neutral-300">
                      {render.created_at ? new Date(render.created_at).toLocaleDateString() : "N/A"}
                    </p>
                  </div>
                  <div className="flex justify-end items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-amber-400 hover:text-amber-200 hover:bg-amber-950/60"
                      onClick={() => window.location.href = `/ar-visualizer/${render.id}`}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>

                {/* Before/After Preview */}
                {render.render_status === "completed" && render.after_image_url && (
                  <div className="mt-3 pt-3 border-t border-neutral-800">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">Before</p>
                        <div className="h-20 rounded bg-neutral-800 overflow-hidden">
                          {render.before_image_url && (
                            <img
                              src={render.before_image_url}
                              alt="Before"
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">After</p>
                        <div className="h-20 rounded bg-neutral-800 overflow-hidden">
                          <img
                            src={render.after_image_url}
                            alt="After"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
