"use client"

import { useEffect, useState } from "react"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

type FileRecord = {
  id: number
  lead_id?: number | null
  homeowner_id?: number | null
  job_id?: number | null
  tenant_id?: number | null
  file_type: string
  tags?: string | null
  storage_path: string
  original_name: string
  mime_type: string
  size_bytes: number
  created_at: string
  updated_at: string
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [leadFilter, setLeadFilter] = useState("")
  const [homeownerFilter, setHomeownerFilter] = useState("")
  const [jobFilter, setJobFilter] = useState("")

  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [meta, setMeta] = useState({
    lead_id: "",
    homeowner_id: "",
    job_id: "",
    tenant_id: "",
    file_type: "generic",
    tags: "",
  })

  async function load() {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (leadFilter) params.set("lead_id", leadFilter)
      if (homeownerFilter) params.set("homeowner_id", homeownerFilter)
      if (jobFilter) params.set("job_id", jobFilter)

      const res = await fetch(`${API_BASE}/files/?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to load files")
      const json = await res.json()
      setFiles(json)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      setError("Select a file first.")
      return
    }

    setError("")
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      if (meta.lead_id) formData.append("lead_id", meta.lead_id)
      if (meta.homeowner_id) formData.append("homeowner_id", meta.homeowner_id)
      if (meta.job_id) formData.append("job_id", meta.job_id)
      if (meta.tenant_id) formData.append("tenant_id", meta.tenant_id)
      if (meta.file_type) formData.append("file_type", meta.file_type)
      if (meta.tags) formData.append("tags", meta.tags)

      const res = await fetch(`${API_BASE}/files/upload`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || "Upload failed")
      }

      await load()
      setFile(null)
      setMeta({
        lead_id: "",
        homeowner_id: "",
        job_id: "",
        tenant_id: "",
        file_type: "generic",
        tags: "",
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function deleteFile(record: FileRecord) {
    if (!confirm(`Delete file "${record.original_name}"?`)) return

    setError("")
    const res = await fetch(`${API_BASE}/files/${record.id}`, {
      method: "DELETE",
    })
    if (!res.ok && res.status !== 204) {
      const text = await res.text()
      setError(text || "Failed to delete file")
      return
    }
    await load()
  }

  function formatSize(bytes: number) {
    if (bytes === 0) return "0 B"
    const units = ["B", "KB", "MB", "GB"]
    let idx = 0
    let value = bytes
    while (value >= 1024 && idx < units.length - 1) {
      value /= 1024
      idx++
    }
    return `${value.toFixed(1)} ${units[idx]}`
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Files & Attachments</h1>
          <p className="text-neutral-400 text-sm">
            Blueprints, photos, contracts, designs – all tied back to leads, homeowners, and jobs.
          </p>
        </div>
      </div>

      {error && (
        <div className="border border-red-700 bg-red-900/40 text-red-200 px-4 py-2 rounded">
          {error}
        </div>
      )}

      <form
        onSubmit={handleUpload}
        className="border border-neutral-800 rounded-lg p-4 bg-neutral-950 flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">File</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-neutral-300 file:mr-2 file:rounded file:border-0 file:bg-orange-500 file:text-black file:px-3 file:py-1 file:text-xs"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Lead ID</label>
            <input
              value={meta.lead_id}
              onChange={(e) => setMeta((m) => ({ ...m, lead_id: e.target.value }))}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">
              Homeowner ID
            </label>
            <input
              value={meta.homeowner_id}
              onChange={(e) =>
                setMeta((m) => ({ ...m, homeowner_id: e.target.value }))
              }
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Job ID</label>
            <input
              value={meta.job_id}
              onChange={(e) => setMeta((m) => ({ ...m, job_id: e.target.value }))}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Tenant ID</label>
            <input
              value={meta.tenant_id}
              onChange={(e) =>
                setMeta((m) => ({ ...m, tenant_id: e.target.value }))
              }
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">File Type</label>
            <input
              value={meta.file_type}
              onChange={(e) =>
                setMeta((m) => ({ ...m, file_type: e.target.value }))
              }
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
              placeholder="photo, contract, design, etc."
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-neutral-400 mb-1">
              Tags (comma separated)
            </label>
            <input
              value={meta.tags}
              onChange={(e) => setMeta((m) => ({ ...m, tags: e.target.value }))}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
              placeholder="before, after, kitchen, contract"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={uploading}
            className="px-4 py-2 rounded bg-orange-500 text-black text-sm font-medium disabled:opacity-60"
          >
            {uploading ? "Uploading..." : "Upload File"}
          </button>
        </div>
      </form>

      <div className="flex items-center gap-3">
        <span className="text-xs text-neutral-400">Filter by relationship:</span>
        <input
          placeholder="Lead ID"
          value={leadFilter}
          onChange={(e) => setLeadFilter(e.target.value)}
          className="w-24 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-white"
        />
        <input
          placeholder="Homeowner ID"
          value={homeownerFilter}
          onChange={(e) => setHomeownerFilter(e.target.value)}
          className="w-32 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-white"
        />
        <input
          placeholder="Job ID"
          value={jobFilter}
          onChange={(e) => setJobFilter(e.target.value)}
          className="w-24 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-white"
        />
        <button
          onClick={load}
          className="px-3 py-1 rounded bg-neutral-800 text-xs text-neutral-100"
        >
          Apply
        </button>
      </div>

      <div className="overflow-x-auto border border-neutral-800 rounded-lg bg-neutral-950">
        <table className="min-w-full text-xs text-neutral-300">
          <thead className="bg-neutral-900 text-neutral-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Lead</th>
              <th className="px-3 py-2 text-left">Homeowner</th>
              <th className="px-3 py-2 text-left">Job</th>
              <th className="px-3 py-2 text-left">Tags</th>
              <th className="px-3 py-2 text-right">Size</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-center">
                  Loading...
                </td>
              </tr>
            ) : files.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-center">
                  No files found.
                </td>
              </tr>
            ) : (
              files.map((f) => (
                <tr
                  key={f.id}
                  className="border-t border-neutral-800 hover:bg-neutral-900/60"
                >
                  <td className="px-3 py-2 text-neutral-500">#{f.id}</td>
                  <td className="px-3 py-2">{f.original_name}</td>
                  <td className="px-3 py-2">{f.file_type}</td>
                  <td className="px-3 py-2">
                    {f.lead_id ? `L-${f.lead_id}` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {f.homeowner_id ? `H-${f.homeowner_id}` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {f.job_id ? `J-${f.job_id}` : "—"}
                  </td>
                  <td className="px-3 py-2 max-w-[160px] truncate">
                    {f.tags || "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatSize(f.size_bytes)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => deleteFile(f)}
                      className="px-2 py-1 rounded bg-red-700 text-white hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
