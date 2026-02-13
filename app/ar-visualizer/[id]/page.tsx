"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Image, Sparkles, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react"
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
  roof_analysis?: Record<string, unknown> | null
  ar_metadata?: Record<string, unknown> | null
  render_settings?: Record<string, unknown> | null
  thumbnail_url?: string | null
  processing_started_at?: string | null
  processing_completed_at?: string | null
  metadata?: Record<string, unknown> | null
  created_at?: string | null
  updated_at?: string | null
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50",
  processing: "bg-blue-500/20 text-blue-300 border-blue-500/50",
  completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  failed: "bg-red-600/20 text-red-400 border-red-600/50",
  cancelled: "bg-slate-500/20 text-slate-300 border-slate-500/50",
}

export default function ARRenderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const renderId = Number(params?.id)

  const [render, setRender] = useState<ARRender | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  async function loadRender() {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`${API_BASE}/visualizer/${renderId}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`Failed to load render (${res.status})`)
      const data: ARRender = await res.json()
      setRender(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load render"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function updateRenderStatus(newStatus: string) {
    try {
      setUpdating(true)
      const res = await fetch(`${API_BASE}/visualizer/${renderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          render_status: newStatus,
        }),
      })

      if (!res.ok) throw new Error("Failed to update status")
      await loadRender()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update"
      alert(message)
    } finally {
      setUpdating(false)
    }
  }

  useEffect(() => {
    loadRender()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 text-neutral-400 animate-spin" />
          <p className="text-neutral-400">Loading render...</p>
        </div>
      </div>
    )
  }

  if (error || !render) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-500/50 bg-red-950/40 px-4 py-3 text-red-200">
          {error || "Render not found"}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/ar-visualizer")}
          className="mt-4 border-neutral-700 text-neutral-200"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Visualizer
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/ar-visualizer")}
            className="text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-white">Render #{render.id}</h1>
            <p className="text-sm text-neutral-400 capitalize">
              {render.render_type.replace(/_/g, " ")}
              {render.homeowner_name && <span> - {render.homeowner_name}</span>}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium capitalize ${
            STATUS_COLORS[render.render_status] || STATUS_COLORS.pending
          }`}
        >
          {render.render_status === "completed" && <CheckCircle className="w-4 h-4" />}
          {render.render_status === "processing" && <RefreshCw className="w-4 h-4 animate-spin" />}
          {render.render_status === "failed" && <XCircle className="w-4 h-4" />}
          {render.render_status === "pending" && <Clock className="w-4 h-4" />}
          {render.render_status}
        </span>
      </header>

      {/* Before/After Images */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Before Image */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <h2 className="text-sm font-semibold text-neutral-400 mb-3">Before</h2>
          <div className="aspect-video rounded-lg overflow-hidden bg-neutral-800 flex items-center justify-center">
            {render.before_image_url ? (
              <img
                src={render.before_image_url}
                alt="Before"
                className="w-full h-full object-cover"
              />
            ) : (
              <Image className="w-16 h-16 text-neutral-600" />
            )}
          </div>
        </div>

        {/* After Image */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <h2 className="text-sm font-semibold text-neutral-400 mb-3">After</h2>
          <div className="aspect-video rounded-lg overflow-hidden bg-neutral-800 flex items-center justify-center">
            {render.after_image_url ? (
              <img
                src={render.after_image_url}
                alt="After"
                className="w-full h-full object-cover"
              />
            ) : render.render_status === "completed" ? (
              <div className="text-center text-neutral-500">
                <Image className="w-16 h-16 mx-auto mb-2" />
                <p className="text-sm">No after image available</p>
              </div>
            ) : (
              <div className="text-center text-neutral-500">
                <RefreshCw className="w-16 h-16 mx-auto mb-2 animate-spin opacity-50" />
                <p className="text-sm">Rendering in progress...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Render Information */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Render Information</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-neutral-400 mb-1">Homeowner</p>
            <p className="text-white">{render.homeowner_name || "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-1">Job</p>
            <p className="text-white">
              {render.job_id ? (
                <a href={`/jobs/${render.job_id}`} className="text-amber-400 hover:underline">
                  Job #{render.job_id}
                </a>
              ) : (
                "N/A"
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-1">Render Type</p>
            <p className="text-white capitalize">{render.render_type.replace(/_/g, " ")}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-1">AR Session ID</p>
            <p className="text-white font-mono text-xs">{render.ar_session_id || "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-1">Created</p>
            <p className="text-white">
              {render.created_at ? new Date(render.created_at).toLocaleString() : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-1">Completed</p>
            <p className="text-white">
              {render.processing_completed_at
                ? new Date(render.processing_completed_at).toLocaleString()
                : "Not completed"}
            </p>
          </div>
        </div>
      </div>

      {/* Panel Selection */}
      {render.panel_selection && Object.keys(render.panel_selection).length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Panel Selection</h2>
          <pre className="text-sm text-neutral-300 bg-neutral-950 rounded p-4 overflow-auto">
            {JSON.stringify(render.panel_selection, null, 2)}
          </pre>
        </div>
      )}

      {/* Roof Analysis */}
      {render.roof_analysis && Object.keys(render.roof_analysis).length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Roof Analysis</h2>
          <pre className="text-sm text-neutral-300 bg-neutral-950 rounded p-4 overflow-auto">
            {JSON.stringify(render.roof_analysis, null, 2)}
          </pre>
        </div>
      )}

      {/* AR Metadata */}
      {render.ar_metadata && Object.keys(render.ar_metadata).length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">AR Session Metadata</h2>
          <pre className="text-sm text-neutral-300 bg-neutral-950 rounded p-4 overflow-auto">
            {JSON.stringify(render.ar_metadata, null, 2)}
          </pre>
        </div>
      )}

      {/* Status Actions */}
      {render.render_status !== "completed" && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Status Actions</h2>
          <div className="flex flex-wrap gap-3">
            {render.render_status === "pending" && (
              <Button
                onClick={() => updateRenderStatus("processing")}
                disabled={updating}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Start Processing
              </Button>
            )}
            {render.render_status === "processing" && (
              <Button
                onClick={() => updateRenderStatus("completed")}
                disabled={updating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark as Completed
              </Button>
            )}
            <Button
              onClick={() => updateRenderStatus("failed")}
              disabled={updating}
              variant="outline"
              className="border-red-600 text-red-400 hover:bg-red-950/40"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Mark as Failed
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
