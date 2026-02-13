"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Download, FileText, CheckCircle, XCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"

type Document = {
  id: number
  document_type: string
  entity_type?: string | null
  entity_id?: number | null
  title: string
  file_path?: string | null
  file_url?: string | null
  storage_url?: string | null
  file_size?: number | null
  mime_type?: string
  status: string
  sign_status: string
  generated_by?: number | null
  signed_by?: number | null
  signed_at?: string | null
  signature_data?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  generated_at?: string | null
  created_at?: string | null
  updated_at?: string | null
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

export default function DocumentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const documentId = Number(params?.id)

  const [document, setDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  async function loadDocument() {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`${API_BASE}/documents/${documentId}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`Failed to load document (${res.status})`)
      const data: Document = await res.json()
      setDocument(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load document"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function updateSignatureStatus(newStatus: string) {
    try {
      setUpdating(true)
      const res = await fetch(`${API_BASE}/documents/${documentId}/signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sign_status: newStatus,
          signed_by: newStatus === "signed" ? 1 : undefined,
        }),
      })

      if (!res.ok) throw new Error("Failed to update signature status")
      await loadDocument()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update"
      alert(message)
    } finally {
      setUpdating(false)
    }
  }

  useEffect(() => {
    loadDocument()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId])

  function formatFileSize(bytes?: number | null): string {
    if (!bytes) return "N/A"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-neutral-400">Loading document...</p>
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-500/50 bg-red-950/40 px-4 py-3 text-red-200">
          {error || "Document not found"}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/documents")}
          className="mt-4 border-neutral-700 text-neutral-200"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Documents
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
            onClick={() => router.push("/documents")}
            className="text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-white">{document.title}</h1>
            <p className="text-sm text-neutral-400">Document #{document.id}</p>
          </div>
        </div>
        {document.file_url && (
          <a href={`${API_BASE}${document.file_url}`} target="_blank" rel="noopener noreferrer">
            <Button className="bg-amber-600 hover:bg-amber-700 text-white">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </a>
        )}
      </header>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-400 mb-1">Document Status</p>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium capitalize ${
                  STATUS_COLORS[document.status] || STATUS_COLORS.draft
                }`}
              >
                {document.status}
              </span>
            </div>
            <FileText className="h-10 w-10 text-blue-400 opacity-50" />
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-400 mb-1">Signature Status</p>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium capitalize ${
                  SIGN_STATUS_COLORS[document.sign_status] || SIGN_STATUS_COLORS.unsigned
                }`}
              >
                {document.sign_status.replace(/_/g, " ")}
              </span>
            </div>
            {document.sign_status === "signed" ? (
              <CheckCircle className="h-10 w-10 text-emerald-400 opacity-50" />
            ) : (
              <Clock className="h-10 w-10 text-yellow-400 opacity-50" />
            )}
          </div>
        </div>
      </div>

      {/* Document Info */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Document Information</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-neutral-400 mb-1">Document Type</p>
            <p className="text-white capitalize">{document.document_type.replace(/_/g, " ")}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-1">File Size</p>
            <p className="text-white">{formatFileSize(document.file_size)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-1">MIME Type</p>
            <p className="text-white">{document.mime_type || "application/pdf"}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-1">Entity</p>
            <p className="text-white capitalize">
              {document.entity_type && document.entity_id
                ? `${document.entity_type} #${document.entity_id}`
                : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-1">Generated At</p>
            <p className="text-white">
              {document.generated_at
                ? new Date(document.generated_at).toLocaleString()
                : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-1">Signed At</p>
            <p className="text-white">
              {document.signed_at ? new Date(document.signed_at).toLocaleString() : "Not signed"}
            </p>
          </div>
        </div>
      </div>

      {/* Signature Actions */}
      {document.sign_status !== "signed" && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Signature Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => updateSignatureStatus("pending_signature")}
              disabled={updating || document.sign_status === "pending_signature"}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Clock className="w-4 h-4 mr-2" />
              Mark as Pending
            </Button>
            <Button
              onClick={() => updateSignatureStatus("signed")}
              disabled={updating}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark as Signed
            </Button>
            <Button
              onClick={() => updateSignatureStatus("declined")}
              disabled={updating}
              variant="outline"
              className="border-red-600 text-red-400 hover:bg-red-950/40"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Mark as Declined
            </Button>
          </div>
        </div>
      )}

      {/* PDF Preview */}
      {document.file_url && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">PDF Preview</h2>
          <div className="w-full h-[800px] bg-neutral-950 rounded-lg overflow-hidden border border-neutral-800">
            <iframe
              src={`${API_BASE}${document.file_url}`}
              className="w-full h-full"
              title="PDF Preview"
            />
          </div>
        </div>
      )}
    </div>
  )
}
