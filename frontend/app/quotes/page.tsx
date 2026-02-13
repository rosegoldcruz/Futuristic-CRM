"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Plus, Pencil, Trash2, X, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api"
import Link from "next/link"

type QuoteStatus =
  | "draft"
  | "sent"
  | "approved"
  | "rejected"
  | "expired"

interface Quote {
  id: number
  tenant_id?: number | null
  lead_id?: number | null
  homeowner_id?: number | null
  status: QuoteStatus | string | null
  total_price: number | null
  valid_until?: string | null
  internal_notes?: string | null
  line_items?: unknown[] | null
  created_at?: string | null
  updated_at?: string | null
}

interface QuoteFormState {
  id?: number
  status: QuoteStatus
  lead_id?: string
  homeowner_id?: string
  total_price: string
  valid_until: string
  internal_notes: string
}

const EMPTY_FORM: QuoteFormState = {
  status: "draft",
  lead_id: "",
  homeowner_id: "",
  total_price: "",
  valid_until: "",
  internal_notes: "",
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<QuoteFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function loadQuotes() {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (search.trim()) params.set("search", search.trim())
      if (statusFilter) params.set("status", statusFilter)
      params.set("limit", "100")
      params.set("offset", "0")

      const data = await apiGet<Quote[]>(`/quotes?${params.toString()}`)
      setQuotes(data)
    } catch (err: unknown) {
      console.error("Failed to load quotes", err)
      setError("Failed to load quotes")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQuotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openCreateModal() {
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEditModal(q: Quote) {
    setForm({
      id: q.id,
      status: (q.status as QuoteStatus) || "draft",
      lead_id: q.lead_id ? String(q.lead_id) : "",
      homeowner_id: q.homeowner_id ? String(q.homeowner_id) : "",
      total_price: q.total_price != null ? String(q.total_price) : "",
      valid_until: q.valid_until ? q.valid_until.slice(0, 10) : "",
      internal_notes: q.internal_notes || "",
    })
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) return
    setModalOpen(false)
    setForm(EMPTY_FORM)
  }

  function handleFormChange<K extends keyof QuoteFormState>(key: K, value: QuoteFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    setSaving(true)
    setError(null)

    const payload: Record<string, unknown> = {
      status: form.status,
      total_price: form.total_price ? parseFloat(form.total_price) : 0,
      internal_notes: form.internal_notes.trim() || null,
      valid_until: form.valid_until || null,
      lead_id: form.lead_id ? parseInt(form.lead_id, 10) : null,
      homeowner_id: form.homeowner_id ? parseInt(form.homeowner_id, 10) : null,
    }

    try {
      if (form.id) {
        await apiPut<Quote>(`/quotes/${form.id}`, payload)
      } else {
        await apiPost<Quote>("/quotes", payload)
      }
      await loadQuotes()
      closeModal()
    } catch (err: unknown) {
      console.error("Failed to save quote", err)
      setError("Failed to save quote")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this quote? This cannot be undone.")) return
    setDeletingId(id)
    setError(null)

    try {
      await apiDelete(`/quotes/${id}`)
      setQuotes((prev) => prev.filter((q) => q.id !== id))
    } catch (err: unknown) {
      console.error("Failed to delete quote", err)
      setError("Failed to delete quote")
    } finally {
      setDeletingId(null)
    }
  }

  function formattedDate(value?: string | null) {
    if (!value) return "—"
    try {
      return format(new Date(value), "yyyy-MM-dd")
    } catch {
      return value
    }
  }

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Quotes</h1>
          <p className="text-sm text-neutral-400">
            Money layer for Vulpine — scoped, priced, ready to close.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadQuotes}
            disabled={loading}
            className="border-neutral-700 text-neutral-200 hover:bg-neutral-800"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
          <Button
            size="sm"
            onClick={openCreateModal}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Quote
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <input
          type="text"
          placeholder="Search quotes (title or notes)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:max-w-xs rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full md:w-48 rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_review">Pending review</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={loadQuotes}
          disabled={loading}
          className="border-neutral-700 text-neutral-200 hover:bg-neutral-800 md:ml-auto"
        >
          Apply
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
              <th className="px-4 py-3 text-left font-medium text-neutral-400">ID</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Quote</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Status</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Lead</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Homeowner</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-400">Total</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Valid Until</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Created</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-neutral-500 text-sm"
                >
                  No quotes yet. Generate one from a job or create manually.
                </td>
              </tr>
            )}

            {quotes.map((q) => (
              <tr
                key={q.id}
                className="border-t border-neutral-900 hover:bg-neutral-900/60 transition-colors"
              >
                <td className="px-4 py-3 text-neutral-300">#{q.id}</td>
                <td className="px-4 py-3 text-neutral-100 max-w-xs truncate">
                  Quote #{q.id}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      q.status === "accepted"
                        ? "bg-emerald-900/60 text-emerald-200 border border-emerald-500/40"
                        : q.status === "rejected"
                        ? "bg-red-900/60 text-red-200 border border-red-500/40"
                        : q.status === "sent"
                        ? "bg-sky-900/60 text-sky-200 border border-sky-500/40"
                        : "bg-neutral-900/80 text-neutral-300 border border-neutral-700/60"
                    }`}
                  >
                    {String(q.status || "").replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-300">
                  {q.lead_id ? `#${q.lead_id}` : "—"}
                </td>
                <td className="px-4 py-3 text-neutral-300">
                  {q.homeowner_id ? `#${q.homeowner_id}` : "—"}
                </td>
                <td className="px-4 py-3 text-right text-neutral-100">
                  ${Number(q.total_price || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-4 py-3 text-neutral-300">
                  {formattedDate(q.valid_until)}
                </td>
                <td className="px-4 py-3 text-neutral-300">
                  {formattedDate(q.created_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-2">
                    <Link href={`/quotes/${q.id}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-amber-400 hover:text-amber-200 hover:bg-amber-950/60"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-neutral-300 hover:text-white hover:bg-neutral-800"
                      onClick={() => openEditModal(q)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:text-red-200 hover:bg-red-950/60"
                      onClick={() => handleDelete(q.id)}
                      disabled={deletingId === q.id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}

            {loading && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-6 text-center text-neutral-500 text-sm"
                >
                  Loading quotes…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-950/95 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
              <h2 className="text-base font-semibold text-white">
                {form.id ? "Edit Quote" : "New Quote"}
              </h2>
              <button
                onClick={closeModal}
                className="text-neutral-400 hover:text-white"
                disabled={saving}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="px-4 py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-neutral-400">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      handleFormChange("status", e.target.value as QuoteStatus)
                    }
                    className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-neutral-400">Total Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.total_price}
                    onChange={(e) =>
                      handleFormChange("total_price", e.target.value)
                    }
                    className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-neutral-400">Lead ID</label>
                  <input
                    type="number"
                    value={form.lead_id}
                    onChange={(e) => handleFormChange("lead_id", e.target.value)}
                    className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="optional"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-neutral-400">Homeowner ID</label>
                  <input
                    type="number"
                    value={form.homeowner_id}
                    onChange={(e) =>
                      handleFormChange("homeowner_id", e.target.value)
                    }
                    className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="optional"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-400">Valid Until</label>
                <input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) =>
                    handleFormChange("valid_until", e.target.value)
                  }
                  className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-400">Notes</label>
                <textarea
                  rows={3}
                  value={form.internal_notes}
                  onChange={(e) => handleFormChange("internal_notes", e.target.value)}
                  className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  placeholder="Optional extra detail, exclusions, etc."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-neutral-300 hover:text-white hover:bg-neutral-800"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={saving}
                >
                  {saving ? "Saving…" : form.id ? "Save changes" : "Create quote"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
