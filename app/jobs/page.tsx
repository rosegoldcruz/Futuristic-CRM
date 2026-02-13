"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { Job } from "@/lib/types"

type JobStatus = "pending" | "ordered" | "in_production" | "shipped" | "delivered" | "scheduled" | "in_progress" | "completed" | "on_hold" | "cancelled" | "issue"

type JobForm = {
  customer_name: string
  status: JobStatus
  quote_id?: number | null
  lead_id?: number | null
  homeowner_id?: number | null
  installer_id?: number | null
  scheduled_date?: string | null
  internal_notes?: string | null
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

function emptyForm(): JobForm {
  return {
    customer_name: "",
    status: "pending",
    quote_id: undefined,
    lead_id: undefined,
    homeowner_id: undefined,
    installer_id: undefined,
    scheduled_date: "",
    internal_notes: "",
  }
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<JobStatus | "">("")
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [form, setForm] = useState<JobForm>(emptyForm())
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function fetchJobs() {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (search.trim()) params.set("search", search.trim())
      if (statusFilter) params.set("status", statusFilter)

      const res = await fetch(`${API_BASE}/jobs/?${params.toString()}`, {
        cache: "no-store",
      })

      if (!res.ok) throw new Error(`Failed to load jobs (${res.status})`)

      const data: Job[] = await res.json()
      setJobs(data)
    } catch (err: any) {
      setError(err.message || "Failed to load jobs")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openCreateModal() {
    setSelectedJob(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEditModal(job: Job) {
    setSelectedJob(job)
    setForm({
      customer_name: job.customer_name,
      status: job.status as JobStatus,
      quote_id: job.quote_id ?? undefined,
      lead_id: job.lead_id ?? undefined,
      homeowner_id: job.homeowner_id ?? undefined,
      scheduled_date: job.scheduled_date
        ? String(job.scheduled_date).slice(0, 16)
        : "",
      internal_notes: job.internal_notes ?? "",
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setSelectedJob(null)
    setForm(emptyForm())
  }

  function handleChange(
    field: keyof JobForm,
    value: string | number | null
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  async function handleSave() {
    try {
      setSaving(true)
      setError(null)

      const payload: any = {
        ...form,
        quote_id:
          form.quote_id === null || form.quote_id === undefined || form.quote_id === ("" as any)
            ? null
            : Number(form.quote_id),
        lead_id:
          form.lead_id === null || form.lead_id === undefined || form.lead_id === ("" as any)
            ? null
            : Number(form.lead_id),
        homeowner_id:
          form.homeowner_id === null ||
          form.homeowner_id === undefined ||
          form.homeowner_id === ("" as any)
            ? null
            : Number(form.homeowner_id),
        scheduled_date: form.scheduled_date || null,
        internal_notes: form.internal_notes || null,
      }

      const isEdit = !!selectedJob
      const url = isEdit
        ? `${API_BASE}/jobs/${selectedJob!.id}` 
        : `${API_BASE}/jobs/` 
      const method = isEdit ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(
          `Save failed (${res.status}): ${text || "Unknown error"}` 
        )
      }

      await fetchJobs()
      closeModal()
    } catch (err: any) {
      setError(err.message || "Failed to save job")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(job: Job) {
    if (!confirm(`Delete job "${job.customer_name}"?`)) return

    try {
      setError(null)
      const res = await fetch(`${API_BASE}/jobs/${job.id}`, {
        method: "DELETE",
      })
      if (!res.ok && res.status !== 204) {
        throw new Error(`Delete failed (${res.status})`)
      }
      await fetchJobs()
    } catch (err: any) {
      setError(err.message || "Failed to delete job")
    }
  }

  const filteredJobs = jobs // backend already does filtering; this is just for UI consistency

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Jobs Command Deck
          </h1>
          <p className="text-sm text-neutral-400">
            Track every install from lead → scheduled → completed.
          </p>
        </div>

        <div className="flex gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs..."
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as JobStatus | "")
            }
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="ordered">Ordered</option>
            <option value="in_production">In Production</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="cancelled">Cancelled</option>
            <option value="issue">Issue</option>
          </select>
          <button
            onClick={fetchJobs}
            className="rounded-md bg-neutral-800 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700"
          >
            Refresh
          </button>
          <button
            onClick={openCreateModal}
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-black hover:bg-orange-400"
          >
            New Job
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-red-800 bg-red-950 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950">
        <table className="min-w-full text-left text-sm text-neutral-200">
          <thead className="bg-neutral-900 text-xs uppercase text-neutral-400">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Homeowner</th>
              <th className="px-4 py-3">Scheduled</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-neutral-400"
                >
                  Loading jobs…
                </td>
              </tr>
            ) : filteredJobs.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-neutral-500"
                >
                  No jobs found.
                </td>
              </tr>
            ) : (
              filteredJobs.map((job) => (
                <tr
                  key={job.id}
                  className="border-t border-neutral-800 hover:bg-neutral-900/60"
                >
                  <td className="px-4 py-3 text-xs text-neutral-400">
                    #{job.id}
                  </td>
                  <td className="px-4 py-3">{job.customer_name}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-neutral-800 px-2 py-1 text-xs capitalize">
                      {(job.status || "pending").replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-400">
                    {job.lead_id ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-400">
                    {job.homeowner_id ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-400">
                    {job.scheduled_date
                      ? new Date(job.scheduled_date).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-400">
                    {job.created_at ? new Date(job.created_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="mr-2 rounded bg-amber-600 px-2 py-1 text-white hover:bg-amber-500"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => openEditModal(job)}
                      className="mr-2 rounded bg-neutral-800 px-2 py-1 hover:bg-neutral-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(job)}
                      className="rounded bg-red-600 px-2 py-1 text-white hover:bg-red-500"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-lg rounded-lg border border-neutral-800 bg-neutral-950 p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-white">
              {selectedJob ? "Edit Job" : "New Job"}
            </h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-400">
                  Customer Name
                </label>
                <input
                  value={form.customer_name}
                  onChange={(e) => handleChange("customer_name", e.target.value)}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-400">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      handleChange("status", e.target.value as JobStatus)
                    }
                    className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="ordered">Ordered</option>
                    <option value="in_production">In Production</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="issue">Issue</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-400">
                    Scheduled date/time
                  </label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_date || ""}
                    onChange={(e) =>
                      handleChange("scheduled_date", e.target.value)
                    }
                    className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-400">
                    Lead ID
                  </label>
                  <input
                    type="number"
                    value={form.lead_id ?? ""}
                    onChange={(e) =>
                      handleChange(
                        "lead_id",
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-400">
                    Homeowner ID
                  </label>
                  <input
                    type="number"
                    value={form.homeowner_id ?? ""}
                    onChange={(e) =>
                      handleChange(
                        "homeowner_id",
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-400">
                  Notes
                </label>
                <textarea
                  value={form.internal_notes || ""}
                  onChange={(e) => handleChange("internal_notes", e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-black hover:bg-orange-400 disabled:opacity-60"
              >
                {saving
                  ? selectedJob
                    ? "Saving…"
                    : "Creating…"
                  : selectedJob
                  ? "Save changes"
                  : "Create job"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
