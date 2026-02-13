"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { FileText } from "lucide-react"

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
  homeowner_info?: any
  installer_info?: any
  project_details?: any
  materials_snapshot?: any[] | null
  labor_instructions?: any[] | null
  timeline?: any
  special_instructions?: string | null
  internal_notes?: string | null
  created_at?: string | null
  updated_at?: string | null
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

export default function WorkOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const workOrderId = params.id as string

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [allowedStatuses, setAllowedStatuses] = useState<WorkOrderStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function fetchWorkOrder() {
    try {
      const res = await fetch(`${API_BASE}/work-orders/${workOrderId}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`Failed to load work order (${res.status})`)
      const data: WorkOrder = await res.json()
      setWorkOrder(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load work order"
      setError(message)
    }
  }

  async function fetchAllowedStatuses() {
    try {
      const res = await fetch(`${API_BASE}/work-orders/${workOrderId}/allowed-statuses`, {
        cache: "no-store",
      })
      if (!res.ok) return
      const data: WorkOrderStatus[] = await res.json()
      setAllowedStatuses(data)
    } catch (err) {
      console.error("Failed to load allowed statuses:", err)
    }
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      await fetchWorkOrder()
      await fetchAllowedStatuses()
      setLoading(false)
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId])

  async function handleStatusChange(newStatus: WorkOrderStatus) {
    try {
      setSaving(true)
      setError(null)

      const res = await fetch(`${API_BASE}/work-orders/${workOrderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || "Failed to update status")
      }

      await fetchWorkOrder()
      await fetchAllowedStatuses()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update status"
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-neutral-400">Loading work order…</p>
      </div>
    )
  }

  if (!workOrder) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <p className="text-red-400">Work order not found</p>
        <Link href="/work-orders" className="mt-4 text-amber-400 hover:underline">
          ← Back to Work Orders
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white">Work Order #{workOrder.id}</h1>
            <span
              className={`rounded-full border px-3 py-1 text-sm font-medium ${
                STATUS_COLORS[(workOrder.status as WorkOrderStatus) || "created"]
              }`}
            >
              {STATUS_LABELS[(workOrder.status as WorkOrderStatus) || "created"]}
            </span>
          </div>
          <p className="text-sm text-neutral-400">
            Job #{workOrder.job_id} - {workOrder.customer_name || "No customer"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => alert("PDF download not yet implemented")}
            className="flex items-center gap-2 rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            <FileText className="w-4 h-4" />
            Download PDF
          </button>
          <Link
            href="/work-orders"
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            ← Back to Work Orders
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-red-800 bg-red-950 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Homeowner Info */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Homeowner Information
            </h2>
            {workOrder.homeowner_info ? (
              <div className="grid gap-3 text-sm">
                <div>
                  <p className="text-xs text-neutral-500">Name</p>
                  <p className="text-white">{workOrder.homeowner_info.name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Contact</p>
                  <p className="text-white">{workOrder.homeowner_info.phone || "—"}</p>
                  <p className="text-white">{workOrder.homeowner_info.email || "—"}</p>
                </div>
                {workOrder.homeowner_info.address && (
                  <div>
                    <p className="text-xs text-neutral-500">Address</p>
                    <p className="text-white">
                      {workOrder.homeowner_info.address.street || ""}
                      <br />
                      {workOrder.homeowner_info.address.city},{" "}
                      {workOrder.homeowner_info.address.state} {workOrder.homeowner_info.address.zip}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No homeowner information available</p>
            )}
          </div>

          {/* Materials Snapshot */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Materials Required
            </h2>
            {workOrder.materials_snapshot && workOrder.materials_snapshot.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-left text-xs text-slate-500">
                      <th className="pb-2">Description</th>
                      <th className="pb-2">Details</th>
                      <th className="pb-2 text-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workOrder.materials_snapshot.map((item: any, index: number) => (
                      <tr key={index} className="border-b border-slate-800">
                        <td className="py-2">
                          <p className="text-white">{item.description || "—"}</p>
                          {item.sku && <p className="text-xs text-slate-500">SKU: {item.sku}</p>}
                        </td>
                        <td className="py-2 text-slate-400">
                          {[item.style, item.color, item.finish].filter(Boolean).join(" / ") || "—"}
                        </td>
                        <td className="py-2 text-right text-white">
                          {item.quantity} {item.unit || "each"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No materials specified</p>
            )}
          </div>

          {/* Labor Instructions */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Labor Instructions
            </h2>
            {workOrder.labor_instructions && workOrder.labor_instructions.length > 0 ? (
              <div className="space-y-3">
                {workOrder.labor_instructions.map((item: any, index: number) => (
                  <div key={index} className="rounded-md border border-slate-700 bg-slate-800/50 p-3">
                    <p className="font-medium text-white">{item.description}</p>
                    <div className="mt-2 flex gap-4 text-sm text-slate-400">
                      {item.hours && <span>{item.hours} hours</span>}
                      {item.installer_name && <span>Installer: {item.installer_name}</span>}
                    </div>
                    {item.notes && <p className="mt-2 text-sm text-slate-500">{item.notes}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No labor instructions specified</p>
            )}
          </div>

          {/* Special Instructions */}
          {workOrder.special_instructions && (
            <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber-400">
                Special Instructions
              </h2>
              <p className="text-sm text-white whitespace-pre-wrap">{workOrder.special_instructions}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Workflow */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Status Workflow
            </h2>
            <div className="mb-4">
              <p className="text-xs text-neutral-500 mb-2">Current Status</p>
              <span
                className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${
                  STATUS_COLORS[(workOrder.status as WorkOrderStatus) || "created"]
                }`}
              >
                {STATUS_LABELS[(workOrder.status as WorkOrderStatus) || "created"]}
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
                        STATUS_COLORS[status]
                      }`}
                    >
                      → {STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No status transitions available</p>
            )}
          </div>

          {/* Installer Info */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Installer Assignment
            </h2>
            {workOrder.installer_info ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-neutral-500">Name</p>
                  <Link
                    href={`/installers/${workOrder.installer_id}`}
                    className="text-amber-400 hover:underline"
                  >
                    {workOrder.installer_info.name || "—"}
                  </Link>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Contact</p>
                  <p className="text-white">{workOrder.installer_info.phone || "—"}</p>
                  <p className="text-white">{workOrder.installer_info.email || "—"}</p>
                </div>
                {workOrder.installer_info.skills && (
                  <div>
                    <p className="text-xs text-neutral-500">Skills</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {workOrder.installer_info.skills.map((skill: string) => (
                        <span
                          key={skill}
                          className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No installer assigned</p>
            )}
          </div>

          {/* Schedule */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Schedule
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-neutral-500">Date</p>
                <p className="text-white">
                  {workOrder.scheduled_date
                    ? new Date(workOrder.scheduled_date).toLocaleDateString()
                    : "Not scheduled"}
                </p>
              </div>
              {workOrder.scheduled_time_start && (
                <div>
                  <p className="text-xs text-neutral-500">Time</p>
                  <p className="text-white">
                    {workOrder.scheduled_time_start}
                    {workOrder.scheduled_time_end && ` - ${workOrder.scheduled_time_end}`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Links */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Related
            </h2>
            <div className="space-y-2 text-sm">
              <Link href={`/jobs/${workOrder.job_id}`} className="block text-amber-400 hover:underline">
                View Job #{workOrder.job_id}
              </Link>
              {workOrder.installer_id && (
                <Link
                  href={`/installers/${workOrder.installer_id}`}
                  className="block text-amber-400 hover:underline"
                >
                  View Installer Profile
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
