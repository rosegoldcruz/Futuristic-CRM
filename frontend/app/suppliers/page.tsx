"use client"

import { useEffect, useState } from "react"
import type { Supplier } from "@/lib/types"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

const TYPE_OPTIONS = ["doors", "panels", "hardware", "shop", "other"]

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [stateFilter, setStateFilter] = useState("")
  const [activeOnly, setActiveOnly] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)

  const [form, setForm] = useState({
    tenant_id: "",
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    website: "",
    supplier_type: "",
    address_city: "",
    address_state: "",
    address_zip: "",
    internal_notes: "",
    is_active: true,
  })

  function openCreate() {
    setEditing(null)
    setForm({
      tenant_id: "",
      company_name: "",
      contact_name: "",
      email: "",
      phone: "",
      website: "",
      supplier_type: "",
      address_city: "",
      address_state: "",
      address_zip: "",
      internal_notes: "",
      is_active: true,
    })
    setModalOpen(true)
  }

  function openEdit(s: Supplier) {
    setEditing(s)
    setForm({
      tenant_id: s.tenant_id?.toString() || "",
      company_name: s.company_name,
      contact_name: s.contact_name || "",
      email: s.email || "",
      phone: s.phone || "",
      website: s.website || "",
      supplier_type: s.supplier_type || "",
      address_city: s.address_city || "",
      address_state: s.address_state || "",
      address_zip: s.address_zip || "",
      internal_notes: s.internal_notes || "",
      is_active: s.is_active ?? true,
    })
    setModalOpen(true)
  }

  async function load() {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (typeFilter) params.set("supplier_type", typeFilter)
      if (stateFilter) params.set("state", stateFilter)
      params.set("active_only", activeOnly ? "true" : "false")

      const res = await fetch(`${API_BASE}/suppliers/?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to load suppliers")
      const json = await res.json()
      setSuppliers(json)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    const payload: any = {
      company_name: form.company_name,
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      website: form.website || null,
      supplier_type: form.supplier_type || null,
      address_city: form.address_city || null,
      address_state: form.address_state || null,
      address_zip: form.address_zip || null,
      internal_notes: form.internal_notes || null,
      is_active: form.is_active,
    }

    if (form.tenant_id) payload.tenant_id = parseInt(form.tenant_id, 10)

    const url = editing
      ? `${API_BASE}/suppliers/${editing.id}` 
      : `${API_BASE}/suppliers/` 
    const method = editing ? "PUT" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text()
      setError(text || "Failed to save supplier")
      return
    }

    setModalOpen(false)
    setEditing(null)
    await load()
  }

  async function deleteSupplier(s: Supplier) {
    if (!confirm(`Delete supplier "${s.company_name}"?`)) return
    setError("")
    const res = await fetch(`${API_BASE}/suppliers/${s.id}`, {
      method: "DELETE",
    })
    if (!res.ok && res.status !== 204) {
      const text = await res.text()
      setError(text || "Failed to delete supplier")
      return
    }
    await load()
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Suppliers</h1>
          <p className="text-neutral-400 text-sm">
            Door shops, panel vendors, hardware sources — the full material spine.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded bg-orange-500 text-black text-sm font-medium"
        >
          New Supplier
        </button>
      </div>

      {error && (
        <div className="border border-red-700 bg-red-900/40 text-red-200 px-4 py-2 rounded">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          placeholder="Search name/city"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
        >
          <option value="">All types</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t[0].toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
        <input
          placeholder="State"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="w-20 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
        />
        <label className="flex items-center gap-1 text-xs text-neutral-300">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="accent-orange-500"
          />
          Active only
        </label>
        <button
          onClick={load}
          className="px-3 py-1 rounded bg-neutral-800 text-xs text-neutral-100"
        >
          Apply Filters
        </button>
      </div>

      <div className="overflow-x-auto border border-neutral-800 rounded-lg bg-neutral-950">
        <table className="min-w-full text-xs text-neutral-300">
          <thead className="bg-neutral-900 text-neutral-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Contact</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">City</th>
              <th className="px-3 py-2 text-left">State</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">Website</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-center">
                  Loading…
                </td>
              </tr>
            ) : suppliers.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-center">
                  No suppliers yet.
                </td>
              </tr>
            ) : (
              suppliers.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-neutral-800 hover:bg-neutral-900/60"
                >
                  <td className="px-3 py-2">{s.company_name}</td>
                  <td className="px-3 py-2">
                    {s.contact_name || "—"}{" "}
                    {s.email && (
                      <span className="text-neutral-500">({s.email})</span>
                    )}
                  </td>
                  <td className="px-3 py-2 capitalize">
                    {s.supplier_type || "—"}
                  </td>
                  <td className="px-3 py-2">{s.address_city || "—"}</td>
                  <td className="px-3 py-2">{s.address_state || "—"}</td>
                  <td className="px-3 py-2">{s.phone || "—"}</td>
                  <td className="px-3 py-2">
                    {s.website ? (
                      <a
                        href={s.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-orange-400 hover:underline"
                      >
                        Site
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {s.is_active ? (
                      <span className="text-green-400">Active</span>
                    ) : (
                      <span className="text-neutral-500">Inactive</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      onClick={() => openEdit(s)}
                      className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteSupplier(s)}
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

      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <h2 className="text-sm font-semibold text-white">
                {editing ? `Edit Supplier #${editing.id}` : "New Supplier"}
              </h2>
              <button
                onClick={() => {
                  setModalOpen(false)
                  setEditing(null)
                }}
                className="text-neutral-400 hover:text-neutral-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={save} className="p-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">Tenant ID</label>
                  <input
                    value={form.tenant_id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tenant_id: e.target.value }))
                    }
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-white"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-neutral-400 mb-1">Company Name</label>
                  <input
                    required
                    value={form.company_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, company_name: e.target.value }))
                    }
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">
                    Contact name
                  </label>
                  <input
                    value={form.contact_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, contact_name: e.target.value }))
                    }
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-white"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Email</label>
                  <input
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-white"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">
                    Website (https://…)
                  </label>
                  <input
                    value={form.website}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, website: e.target.value }))
                    }
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-white"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Type</label>
                  <select
                    value={form.supplier_type}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, supplier_type: e.target.value }))
                    }
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-white"
                  >
                    <option value="">—</option>
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t[0].toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-5">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, is_active: e.target.checked }))
                    }
                    className="accent-orange-500"
                  />
                  <span className="text-neutral-300">Active</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">City</label>
                  <input
                    value={form.address_city}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, address_city: e.target.value }))
                    }
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-white"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">State</label>
                  <input
                    value={form.address_state}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, address_state: e.target.value }))
                    }
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-white"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">ZIP</label>
                  <input
                    value={form.address_zip}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, address_zip: e.target.value }))
                    }
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={form.internal_notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, internal_notes: e.target.value }))
                  }
                  className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-white"
                />
              </div>

              <div className="flex justify-end gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false)
                    setEditing(null)
                  }}
                  className="px-3 py-1 rounded border border-neutral-700 text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-orange-500 text-black font-medium"
                >
                  {editing ? "Save Changes" : "Create Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
