"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Eye, FileText, Download, CheckCircle, Clock, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

type Document = {
  id: number
  document_type: string
  entity_type?: string | null
  entity_id?: number | null
  title: string
  file_path?: string | null
  file_url?: string | null
  file_size?: number | null
  mime_type?: string
  status: string
  sign_status: string
  signed_at?: string | null
  signed_by?: number | null
  created_at?: string | null
  generated_at?: string | null
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-500/20 text-slate-300 border-slate-500/50",
  generating: "bg-blue-500/20 text-blue-300 border-blue-500/50",
  generated: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  sent: "bg-purple-500/20 text-purple-300 border-purple-500/50",
  viewed: "bg-cyan-500/20 text-cyan-300 border-cyan-500/50",
  archived: "bg-neutral-500/20 text-neutral-300 border-neutral-500/50",
  cancelled: "bg-red-600/20 text-red-400 border-red-600/50",
}

const SIGN_STATUS_COLORS: Record<string, string> = {
  unsigned: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50",
  pending_signature: "bg-blue-500/20 text-blue-300 border-blue-500/50",
  partially_signed: "bg-amber-500/20 text-amber-300 border-amber-500/50",
  signed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  declined: "bg-red-600/20 text-red-400 border-red-600/50",
  expired: "bg-neutral-500/20 text-neutral-300 border-neutral-500/50",
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [signStatusFilter, setSignStatusFilter] = useState<string>("")
  const [typeFilter, setTypeFilter] = useState<string>("")

  const [stats, setStats] = useState({
    total: 0,
    signed: 0,
    pending: 0,
    generated: 0,
  })

  async function loadDocuments() {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      if (signStatusFilter) params.set("sign_status", signStatusFilter)
      if (typeFilter) params.set("document_type", typeFilter)
      params.set("limit", "100")

      const res = await fetch(`${API_BASE}/documents/?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`Failed to load documents (${res.status})`)
      const data: Document[] = await res.json()
      setDocuments(data)

      // Calculate stats
      const total = data.length
      const signed = data.filter((d) => d.sign_status === "signed").length
      const pending = data.filter((d) => d.sign_status === "pending_signature").length
      const generated = data.filter((d) => d.status === "generated").length

      setStats({ total, signed, pending, generated })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load documents"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, signStatusFilter, typeFilter])

  function formatFileSize(bytes?: number | null): string {
    if (!bytes) return "—"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Documents</h1>
          <p className="text-sm text-neutral-400">PDF generation and e-signature tracking</p>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-neutral-400">Total Documents</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.signed}</p>
              <p className="text-xs text-neutral-400">Signed</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.pending}</p>
              <p className="text-xs text-neutral-400">Pending Signature</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-purple-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.generated}</p>
              <p className="text-xs text-neutral-400">Generated</p>
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
          <option value="draft">Draft</option>
          <option value="generating">Generating</option>
          <option value="generated">Generated</option>
          <option value="sent">Sent</option>
          <option value="viewed">Viewed</option>
          <option value="archived">Archived</option>
        </select>

        <select
          value={signStatusFilter}
          onChange={(e) => setSignStatusFilter(e.target.value)}
          className="w-full md:w-48 rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
        >
          <option value="">All signature statuses</option>
          <option value="unsigned">Unsigned</option>
          <option value="pending_signature">Pending</option>
          <option value="signed">Signed</option>
          <option value="declined">Declined</option>
          <option value="expired">Expired</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-full md:w-48 rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
        >
          <option value="">All types</option>
          <option value="quote_pdf">Quote PDF</option>
          <option value="work_order_pdf">Work Order PDF</option>
          <option value="agreement">Agreement</option>
          <option value="contract">Contract</option>
          <option value="invoice">Invoice</option>
          <option value="receipt">Receipt</option>
        </select>

        <Button
          variant="outline"
          size="sm"
          onClick={loadDocuments}
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
              <th className="px-4 py-3 text-left font-medium text-neutral-400">ID</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Title</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Type</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Entity</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Size</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Status</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Signature</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Date</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-neutral-500 text-sm">
                  No documents yet
                </td>
              </tr>
            )}

            {documents.map((doc) => (
              <tr
                key={doc.id}
                className="border-t border-neutral-900 hover:bg-neutral-900/60 transition-colors"
              >
                <td className="px-4 py-3 text-neutral-300 font-medium">#{doc.id}</td>
                <td className="px-4 py-3">
                  <span className="text-white font-medium">{doc.title}</span>
                </td>
                <td className="px-4 py-3 text-neutral-400 capitalize text-xs">
                  {doc.document_type.replace(/_/g, " ")}
                </td>
                <td className="px-4 py-3 text-neutral-400 text-xs">
                  {doc.entity_type && doc.entity_id ? (
                    <span className="capitalize">
                      {doc.entity_type} #{doc.entity_id}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-400 text-xs">
                  {formatFileSize(doc.file_size)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
                      STATUS_COLORS[doc.status] || STATUS_COLORS.draft
                    }`}
                  >
                    {doc.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
                      SIGN_STATUS_COLORS[doc.sign_status] || SIGN_STATUS_COLORS.unsigned
                    }`}
                  >
                    {doc.sign_status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-300 text-xs">
                  {doc.generated_at
                    ? new Date(doc.generated_at).toLocaleDateString()
                    : doc.created_at
                    ? new Date(doc.created_at).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/documents/${doc.id}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-amber-400 hover:text-amber-200 hover:bg-amber-950/60"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                    {doc.file_url && (
                      <a href={`${API_BASE}${doc.file_url}`} target="_blank" rel="noopener noreferrer">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-400 hover:text-blue-200 hover:bg-blue-950/60"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {loading && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-neutral-500 text-sm">
                  Loading documents…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
