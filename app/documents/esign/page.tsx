"use client"

import { useEffect, useState, useRef } from "react"
import { FileText, FileSignature, CheckCircle, Clock, User, History } from "lucide-react"
import { Button } from "@/components/ui/button"

type Signature = {
  id: number
  signer_name: string
  signer_email?: string
  signer_role?: string
  signature_order: number
  status: string
  signed_at?: string
  signature_data?: string
}

type DocumentVersion = {
  id: number
  version_number: number
  file_url?: string
  changes_description?: string
  created_at: string
}

type AuditLog = {
  id: number
  action: string
  performed_by_name?: string
  details?: string
  created_at: string
}

type Document = {
  id: number
  title: string
  document_type: string
  status: string
  sign_status: string
  storage_url?: string
  created_at: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

export default function DocumentESignPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signingId, setSigningId] = useState<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  useEffect(() => {
    loadDocuments()
  }, [])

  async function loadDocuments() {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/documents/?limit=50`, { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setDocuments(data)
      }
    } catch (err) {
      console.error("Failed to load documents:", err)
    } finally {
      setLoading(false)
    }
  }

  async function loadDocumentDetails(docId: number) {
    try {
      const [sigsRes, versionsRes, auditRes] = await Promise.all([
        fetch(`${API_BASE}/documents/${docId}/signatures`),
        fetch(`${API_BASE}/documents/${docId}/versions`),
        fetch(`${API_BASE}/documents/${docId}/audit`),
      ])

      if (sigsRes.ok) setSignatures(await sigsRes.json())
      if (versionsRes.ok) setVersions(await versionsRes.json())
      if (auditRes.ok) setAuditLogs(await auditRes.json())
    } catch (err) {
      console.error("Failed to load document details:", err)
    }
  }

  function selectDocument(doc: Document) {
    setSelectedDoc(doc)
    loadDocumentDetails(doc.id)
  }

  function startSigning(signatureId: number) {
    setSigningId(signatureId)
    setSigning(true)
  }

  function clearSignature() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  async function submitSignature() {
    const canvas = canvasRef.current
    if (!canvas || !signingId) return

    const signatureData = canvas.toDataURL("image/png")

    try {
      const res = await fetch(`${API_BASE}/documents/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature_id: signingId,
          signature_data: signatureData,
          ip_address: "192.168.1.1",
          user_agent: navigator.userAgent,
        }),
      })

      if (res.ok) {
        setSigning(false)
        setSigningId(null)
        clearSignature()
        if (selectedDoc) {
          await loadDocumentDetails(selectedDoc.id)
          await loadDocuments()
        }
        alert("Document signed successfully!")
      } else {
        const error = await res.json()
        alert(`Error: ${error.detail}`)
      }
    } catch (err) {
      console.error("Failed to sign:", err)
      alert("Failed to sign document")
    }
  }

  function startDrawing(e: React.MouseEvent<HTMLCanvasElement>) {
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }

  function stopDrawing() {
    setIsDrawing(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-neutral-400">Loading documents...</p>
      </div>
    )
  }

  if (!selectedDoc) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <header>
          <h1 className="text-2xl font-semibold text-white">Documents & E-Sign</h1>
          <p className="text-sm text-neutral-400">Select a document to view signatures</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => selectDocument(doc)}
              className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 hover:bg-neutral-800 cursor-pointer transition"
            >
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <h3 className="font-medium text-white">{doc.title}</h3>
              </div>
              <p className="text-xs text-neutral-500 mb-2 capitalize">{doc.document_type}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/50 capitalize">
                  {doc.status}
                </span>
                <span className={`text-xs px-2 py-1 rounded capitalize ${
                  doc.sign_status === "signed"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                }`}>
                  {doc.sign_status?.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedDoc(null)}
          className="mb-2 text-neutral-400"
        >
          ← Back to Documents
        </Button>
        <h1 className="text-2xl font-semibold text-white">{selectedDoc.title}</h1>
        <p className="text-sm text-neutral-400">Document #{selectedDoc.id}</p>
      </header>

      {/* PDF Viewer Placeholder */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-8 text-center">
        <FileText className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
        <p className="text-neutral-400">PDF Viewer</p>
        <p className="text-xs text-neutral-500 mt-2">{selectedDoc.storage_url}</p>
        {selectedDoc.storage_url && (
          <Button variant="outline" size="sm" className="mt-4">
            Download PDF
          </Button>
        )}
      </div>

      {/* Signatures */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileSignature className="w-5 h-5" />
          Signatures
        </h2>
        <div className="space-y-3">
          {signatures.map((sig) => (
            <div key={sig.id} className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    sig.status === "signed"
                      ? "bg-emerald-500/20 border border-emerald-500/50"
                      : "bg-neutral-800 border border-neutral-700"
                  }`}>
                    {sig.status === "signed" ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-neutral-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-white">{sig.signer_name}</p>
                    {sig.signer_email && (
                      <p className="text-xs text-neutral-500">{sig.signer_email}</p>
                    )}
                    {sig.signed_at && (
                      <p className="text-xs text-neutral-500 mt-1">
                        Signed: {new Date(sig.signed_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">Order: {sig.signature_order}</span>
                  {sig.status === "pending" && (
                    <Button
                      size="sm"
                      onClick={() => startSigning(sig.id)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Sign
                    </Button>
                  )}
                  {sig.status === "signed" && (
                    <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-300">
                      Signed ✓
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {signatures.length === 0 && (
            <p className="text-center text-neutral-500 py-4">No signatures required</p>
          )}
        </div>
      </div>

      {/* Versions */}
      {versions.length > 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <History className="w-5 h-5" />
            Version History
          </h2>
          <div className="space-y-2">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-white font-medium">Version {v.version_number}</span>
                  {v.changes_description && (
                    <span className="text-neutral-400 ml-2">- {v.changes_description}</span>
                  )}
                </div>
                <span className="text-neutral-500 text-xs">
                  {new Date(v.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signature Modal */}
      {signing && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6 max-w-2xl w-full">
            <h2 className="text-xl font-semibold text-white mb-4">Sign Document</h2>
            <p className="text-sm text-neutral-400 mb-4">
              Draw your signature below using your mouse or touch
            </p>
            <div className="border-2 border-neutral-700 rounded-lg bg-white mb-4">
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="w-full cursor-crosshair"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={clearSignature} variant="outline">
                Clear
              </Button>
              <Button onClick={submitSignature} className="bg-emerald-600 hover:bg-emerald-700">
                Submit Signature
              </Button>
              <Button onClick={() => { setSigning(false); setSigningId(null); }} variant="ghost">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
