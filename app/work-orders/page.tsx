"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Eye, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

type WorkOrderStatus = "created" | "sent" | "accepted" | "in_progress" | "completed" | "cancelled"

interface WorkOrder {
  id: number
  tenant_id?: number | null
  job_id: number
  installer_id?: number | null
  customer_name?: string | null
  installer_name?: string | null
  job_status?: string | null
  status: WorkOrderStatus | string | null
  scheduled_date?: string | null
  scheduled_time_start?: string | null
  scheduled_time_end?: string | null
  created_at?: string | null
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  created: "Created",
  sent: "Sent",
  accepted: "Accepted",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
}

const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  created: "bg-slate-500/20 text-slate-300 border-slate-500/50",
  sent: "bg-blue-500/20 text-blue-300 border-blue-500/50",
  accepted: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50",
  in_progress: "bg-amber-500/20 text-amber-300 border-amber-500/50",
  completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  cancelled: "bg-red-600/20 text-red-400 border-red-600/50",
}

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("")

  async function loadWorkOrders() {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      params.set("limit", "100")

      const res = await fetch(`${API_BASE}/work-orders/?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`Failed to load work orders (${res.status})`)
      const data: WorkOrder[] = await res.json()
      setWorkOrders(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load work orders"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorkOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Work Orders</h1>
          <p className="text-sm text-neutral-400">Execution pipeline for approved jobs</p>
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
          <option value="created">Created</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={loadWorkOrders}
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

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-neutral-800 bg-neutral-950/70">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900/80 border-b border-neutral-800 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">WO#</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Job#</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Customer</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Installer</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Status</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Scheduled</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Created</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {workOrders.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-neutral-500 text-sm">
                  No work orders yet. Generate one from an approved job.
                </td>
              </tr>
            )}

            {workOrders.map((wo) => (
              <tr
                key={wo.id}
                className="border-t border-neutral-900 hover:bg-neutral-900/60 transition-colors"
              >
                <td className="px-4 py-3 text-neutral-300 font-medium">#{wo.id}</td>
                <td className="px-4 py-3">
                  <Link href={`/jobs/${wo.job_id}`} className="text-amber-400 hover:underline">
                    #{wo.job_id}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-100">{wo.customer_name || "—"}</td>
                <td className="px-4 py-3 text-neutral-300">{wo.installer_name || "Not assigned"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      STATUS_COLORS[(wo.status as WorkOrderStatus) || "created"]
                    }`}
                  >
                    {STATUS_LABELS[(wo.status as WorkOrderStatus) || "created"]}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-300">
                  {wo.scheduled_date
                    ? new Date(wo.scheduled_date).toLocaleDateString()
                    : "Not scheduled"}
                </td>
                <td className="px-4 py-3 text-neutral-300">
                  {wo.created_at ? new Date(wo.created_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/work-orders/${wo.id}`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-amber-400 hover:text-amber-200 hover:bg-amber-950/60"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}

            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-neutral-500 text-sm">
                  Loading work orders…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
