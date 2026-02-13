"use client"

import { useEffect, useState } from "react"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

import type { Homeowner } from "@/lib/types"

export default function HomeownersPage() {
  const [homeowners, setHomeowners] = useState<Homeowner[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [cityFilter, setCityFilter] = useState("")
  const [stateFilter, setStateFilter] = useState("")

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Homeowner | null>(null)

  const [form, setForm] = useState({
    tenant_id: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address_street: "",
    address_city: "",
    address_state: "",
    address_zip: "",
    internal_notes: "",
  })

  function openCreate() {
    setEditing(null)
    setForm({
      tenant_id: "",
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      address_street: "",
      address_city: "",
      address_state: "",
      address_zip: "",
      internal_notes: "",
    })
    setModalOpen(true)
  }

  function openEdit(h: Homeowner) {
    setEditing(h)
    setForm({
      tenant_id: h.tenant_id?.toString() || "",
      first_name: h.first_name,
      last_name: h.last_name,
      email: h.email || "",
      phone: h.phone || "",
      address_street: h.address_street || "",
      address_city: h.address_city || "",
      address_state: h.address_state || "",
      address_zip: h.address_zip || "",
      internal_notes: h.internal_notes || "",
    })
    setModalOpen(true)
  }

  async function load() {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (cityFilter) params.set("city", cityFilter)
      if (stateFilter) params.set("state", stateFilter)

      const res = await fetch(`${API_BASE}/homeowners/?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to load homeowners")
      const json = await res.json()
      setHomeowners(json)
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
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      phone: form.phone || null,
      address_street: form.address_street || null,
      address_city: form.address_city || null,
      address_state: form.address_state || null,
      address_zip: form.address_zip || null,
      internal_notes: form.internal_notes || null,
    }

    if (form.tenant_id) payload.tenant_id = parseInt(form.tenant_id, 10)

    const url = editing
      ? `${API_BASE}/homeowners/${editing.id}` 
      : `${API_BASE}/homeowners/` 
    const method = editing ? "PUT" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text()
      setError(text || "Failed to save homeowner")
      return
    }

    setModalOpen(false)
    setEditing(null)
    await load()
  }

  async function deleteHomeowner(h: Homeowner) {
    if (!confirm(`Delete ${h.first_name} ${h.last_name}?`)) return
    setError("")
    const res = await fetch(`${API_BASE}/homeowners/${h.id}`, {
      method: "DELETE",
    })
    if (!res.ok && res.status !== 204) {
      const text = await res.text()
      setError(text || "Failed to delete homeowner")
      return
    }
    await load()
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Homeowners</h1>
          <p className="text-neutral-400 text-sm">
            Every homeowner that's ever picked up the phone, in one clean list.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded bg-orange-500 text-black text-sm font-medium"
        >
          New Homeowner
        </button>
      </div>

      {error && (
        <div className="border border-red-700 bg-red-900/40 text-red-200 px-4 py-2 rounded">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          placeholder="Search name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
        />
        <input
          placeholder="City"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="w-32 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
        />
        <input
          placeholder="State"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="w-20 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
        />
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
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">City</th>
              <th className="px-3 py-2 text-left">State</th>
              <th className="px-3 py-2 text-left">Lead</th>
              <th className="px-3 py-2 text-left">Notes</th>
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
            ) : homeowners.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-center">
                  No homeowners yet.
                </td>
              </tr>
            ) : (
              homeowners.map((h) => (
                <tr
                  key={h.id}
                  className="border-t border-neutral-800 hover:bg-neutral-900/60"
                >
                  <td className="px-3 py-2 text-neutral-500">#{h.id}</td>
                  <td className="px-3 py-2">
                    {h.first_name} {h.last_name}
                  </td>
                  <td className="px-3 py-2">{h.email || "—"}</td>
                  <td className="px-3 py-2">{h.phone || "—"}</td>
                  <td className="px-3 py-2">{h.address_city || "—"}</td>
                  <td className="px-3 py-2">{h.address_state || "—"}</td>
                  <td className="px-3 py-2">—</td>
                  <td className="px-3 py-2 truncate max-w-xs">
                    {h.internal_notes || "—"}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      onClick={() => openEdit(h)}
                      className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteHomeowner(h)}
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
                {editing
                  ? `Edit Homeowner #${editing.id}` 
                  : "New Homeowner"}
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                <div>
                  <label className="block text-neutral-400 mb-1">First name</label>
                  <input
                    required
                    value={form.first_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, first_name: e.target.value }))
                    }
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-white"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Last name</label>
                  <input
                    required
                    value={form.last_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, last_name: e.target.value }))
                    }
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-neutral-400 mb-1">Street Address</label>
                  <input
                    value={form.address_street}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, address_street: e.target.value }))
                    }
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-white"
                  />
                </div>
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
                <div className="grid grid-cols-2 gap-2">
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
                  {editing ? "Save Changes" : "Create Homeowner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
