"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"

type JobStatus =
  | "pending"
  | "ordered"
  | "in_production"
  | "shipped"
  | "delivered"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "on_hold"
  | "cancelled"
  | "issue"

type Job = {
  id: number
  customer_name: string
  status: JobStatus | null
  quote_id?: number | null
  lead_id?: number | null
  homeowner_id?: number | null
  installer_id?: number | null
  installer_name?: string | null
  scheduled_date?: string | null
  scheduled_time_start?: string | null
  scheduled_time_end?: string | null
  project_details?: Record<string, unknown> | null
  internal_notes?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type Installer = {
  id: number
  first_name: string
  last_name: string
  full_name?: string | null
  email?: string | null
  phone: string
  status: string
  tier: string
  rating_average?: number | null
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

const STATUS_LABELS: Record<JobStatus, string> = {
  pending: "Pending",
  ordered: "Ordered",
  in_production: "In Production",
  shipped: "Shipped",
  delivered: "Delivered",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  on_hold: "On Hold",
  cancelled: "Cancelled",
  issue: "Issue",
}

const STATUS_COLORS: Record<JobStatus, string> = {
  pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50",
  ordered: "bg-blue-500/20 text-blue-300 border-blue-500/50",
  in_production: "bg-indigo-500/20 text-indigo-300 border-indigo-500/50",
  shipped: "bg-cyan-500/20 text-cyan-300 border-cyan-500/50",
  delivered: "bg-teal-500/20 text-teal-300 border-teal-500/50",
  scheduled: "bg-purple-500/20 text-purple-300 border-purple-500/50",
  in_progress: "bg-amber-500/20 text-amber-300 border-amber-500/50",
  completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  on_hold: "bg-neutral-500/20 text-neutral-300 border-neutral-500/50",
  cancelled: "bg-red-500/20 text-red-300 border-red-500/50",
  issue: "bg-red-600/20 text-red-400 border-red-600/50",
}

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string

  const [job, setJob] = useState<Job | null>(null)
  const [installers, setInstallers] = useState<Installer[]>([])
  const [allowedStatuses, setAllowedStatuses] = useState<JobStatus[]>([])
  const [workOrder, setWorkOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [selectedInstallerId, setSelectedInstallerId] = useState<string>("")

  async function fetchJob() {
    try {
      const res = await fetch(`${API_BASE}/jobs/${jobId}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`Failed to load job (${res.status})`)
      const data: Job = await res.json()
      setJob(data)
      setSelectedInstallerId(data.installer_id?.toString() || "")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load job"
      setError(message)
    }
  }

  async function fetchInstallers() {
    try {
      const res = await fetch(`${API_BASE}/installers/?status=active&limit=200`, {
        cache: "no-store",
      })
      if (!res.ok) throw new Error(`Failed to load installers (${res.status})`)
      const data: Installer[] = await res.json()
      setInstallers(data)
    } catch (err: unknown) {
      console.error("Failed to load installers:", err)
    }
  }

  async function fetchAllowedStatuses() {
    try {
      const res = await fetch(`${API_BASE}/jobs/${jobId}/allowed-statuses`, {
        cache: "no-store",
      })
      if (!res.ok) return
      const data: JobStatus[] = await res.json()
      setAllowedStatuses(data)
    } catch (err: unknown) {
      console.error("Failed to load allowed statuses:", err)
    }
  }

  async function fetchWorkOrder() {
    try {
      const res = await fetch(`${API_BASE}/work-orders/by-job/${jobId}`, {
        cache: "no-store",
      })
      if (res.ok) {
        const data = await res.json()
        setWorkOrder(data)
      }
    } catch (err: unknown) {
      // Work order doesn't exist yet, that's okay
      setWorkOrder(null)
    }
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      await Promise.all([fetchJob(), fetchInstallers(), fetchWorkOrder()])
      await fetchAllowedStatuses()
      setLoading(false)
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  async function handleAssignInstaller() {
    if (!selectedInstallerId) return

    try {
      setSaving(true)
      setError(null)

      const res = await fetch(`${API_BASE}/jobs/${jobId}/assign-installer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installer_id: parseInt(selectedInstallerId, 10) }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || "Failed to assign installer")
      }

      await fetchJob()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to assign installer"
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(newStatus: JobStatus) {
    try {
      setSaving(true)
      setError(null)

      const res = await fetch(`${API_BASE}/jobs/${jobId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || "Failed to update status")
      }

      await fetchJob()
      await fetchAllowedStatuses()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update status"
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerateWorkOrder() {
    try {
      setSaving(true)
      setError(null)

      const res = await fetch(`${API_BASE}/work-orders/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: parseInt(jobId, 10) }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || "Failed to generate work order")
      }

      const workOrderData = await res.json()
      router.push(`/work-orders/${workOrderData.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate work order"
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-neutral-400">Loading job details…</div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <div className="text-red-400">Job not found</div>
        <Link
          href="/jobs"
          className="rounded-md bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700"
        >
          ← Back to Jobs
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Link
              href="/jobs"
              className="text-sm text-neutral-400 hover:text-white"
            >
              ← Jobs
            </Link>
            <span className="text-neutral-600">/</span>
            <span className="text-sm text-neutral-300">#{job.id}</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">{job.customer_name}</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Created {job.created_at ? new Date(job.created_at).toLocaleDateString() : "—"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${
              STATUS_COLORS[job.status as JobStatus] || "bg-neutral-800"
            }`}
          >
            {STATUS_LABELS[job.status as JobStatus] || job.status || "pending"}
          </span>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-red-800 bg-red-950 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Details Card */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Job Details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-neutral-500">Quote ID</p>
                <p className="text-sm text-white">{job.quote_id ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Lead ID</p>
                <p className="text-sm text-white">{job.lead_id ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Homeowner ID</p>
                <p className="text-sm text-white">{job.homeowner_id ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Scheduled Date</p>
                <p className="text-sm text-white">
                  {job.scheduled_date
                    ? new Date(job.scheduled_date).toLocaleString()
                    : "Not scheduled"}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Last Updated</p>
                <p className="text-sm text-white">
                  {job.updated_at ? new Date(job.updated_at).toLocaleString() : "—"}
                </p>
              </div>
            </div>
            {job.internal_notes && (
              <div className="mt-4">
                <p className="text-xs text-neutral-500">Notes</p>
                <p className="mt-1 text-sm text-neutral-300 whitespace-pre-wrap">
                  {job.internal_notes}
                </p>
              </div>
            )}
            {job.project_details && (
              <div className="mt-4">
                <p className="text-xs text-neutral-500">Project Details</p>
                <pre className="mt-1 text-xs text-neutral-400 bg-neutral-900 p-2 rounded overflow-auto max-h-40">
                  {JSON.stringify(job.project_details, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Status Workflow Card */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Status Workflow
            </h2>
            <div className="mb-4">
              <p className="text-xs text-neutral-500 mb-2">Current Status</p>
              <span
                className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${
                  STATUS_COLORS[job.status as JobStatus] || "bg-neutral-800"
                }`}
              >
                {STATUS_LABELS[job.status as JobStatus] || job.status || "pending"}
              </span>
            </div>

            {allowedStatuses.length > 0 ? (
              <div>
                <p className="text-xs text-neutral-500 mb-2">Available Transitions</p>
                <div className="flex flex-wrap gap-2">
                  {allowedStatuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      disabled={saving}
                      className={`rounded-md border px-3 py-1.5 text-sm transition hover:opacity-80 disabled:opacity-50 ${
                        STATUS_COLORS[status] || "bg-neutral-800 border-neutral-700"
                      }`}
                    >
                      → {STATUS_LABELS[status] || status}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">
                No status transitions available (terminal state)
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Installer Assignment Card */}
          <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-amber-400">
              Assigned Installer
            </h2>

            {job.installer_id ? (
              <Link
                href={`/installers/${job.installer_id}`}
                className="mb-4 flex items-center gap-3 rounded-md p-2 -mx-2 hover:bg-neutral-800/50 transition"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-emerald-400 text-sm font-semibold text-black">
                  {job.installer_name?.[0] || "?"}
                </div>
                <div>
                  <p className="font-medium text-white">
                    {job.installer_name || `Installer #${job.installer_id}`}
                  </p>
                  <p className="text-xs text-neutral-400">ID: {job.installer_id} — Click to view</p>
                </div>
              </Link>
            ) : (
              <p className="mb-4 text-sm text-neutral-400">No installer assigned</p>
            )}

            <div className="space-y-3">
              <select
                value={selectedInstallerId}
                onChange={(e) => setSelectedInstallerId(e.target.value)}
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Select installer...</option>
                {installers.map((installer) => (
                  <option key={installer.id} value={installer.id}>
                    {installer.full_name || `${installer.first_name} ${installer.last_name}`}
                    {installer.rating_average ? ` (★${installer.rating_average.toFixed(1)})` : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAssignInstaller}
                disabled={!selectedInstallerId || saving}
                className="w-full rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400 disabled:opacity-50"
              >
                {saving ? "Assigning…" : job.installer_id ? "Reassign Installer" : "Assign Installer"}
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Quick Actions
            </h2>
            <div className="space-y-2">
              {workOrder ? (
                <Link href={`/work-orders/${workOrder.id}`}>
                  <button className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
                    View Work Order #{workOrder.id}
                  </button>
                </Link>
              ) : (
                <button
                  onClick={handleGenerateWorkOrder}
                  disabled={saving}
                  className="w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  {saving ? "Generating…" : "Generate Work Order"}
                </button>
              )}
              <button
                onClick={() => router.push(`/jobs`)}
                className="w-full rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
              >
                ← Back to Jobs List
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
