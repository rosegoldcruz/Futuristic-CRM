"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"

type QuoteStatus = "draft" | "pending" | "sent" | "approved" | "rejected" | "expired" | "cancelled"

type LineItem = {
  item_type: string
  description: string
  product_id?: number | null
  product_name?: string | null
  sku?: string | null
  style?: string | null
  color?: string | null
  finish?: string | null
  quantity: number
  unit?: string | null
  unit_price: number
  total: number
  notes?: string | null
}

type LaborItem = {
  description: string
  hours: number
  hourly_rate: number
  installer_id?: number | null
  installer_name?: string | null
  total: number
}

type Quote = {
  id: number
  tenant_id?: number | null
  lead_id?: number | null
  homeowner_id?: number | null
  homeowner_name?: string | null
  lead_name?: string | null
  status: QuoteStatus | null
  valid_until?: string | null
  internal_notes?: string | null
  line_items?: LineItem[] | null
  labor_items?: LaborItem[] | null
  materials_subtotal: number
  labor_subtotal: number
  adjustments_total: number
  discount_total: number
  tax_rate: number
  tax_amount: number
  total_price: number
  created_at?: string | null
  updated_at?: string | null
}

type Product = {
  id: number
  name: string
  category: string
  base_price?: number | null
  unit?: string | null
  available_styles?: string[] | null
  available_colors?: string[] | null
  available_finishes?: string[] | null
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Draft",
  pending: "Pending Review",
  sent: "Sent to Customer",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
  cancelled: "Cancelled",
}

const STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: "bg-slate-500/20 text-slate-300 border-slate-500/50",
  pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50",
  sent: "bg-blue-500/20 text-blue-300 border-blue-500/50",
  approved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  rejected: "bg-red-500/20 text-red-300 border-red-500/50",
  expired: "bg-neutral-500/20 text-neutral-300 border-neutral-500/50",
  cancelled: "bg-red-600/20 text-red-400 border-red-600/50",
}

export default function QuoteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const quoteId = params.id as string

  const [quote, setQuote] = useState<Quote | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [allowedStatuses, setAllowedStatuses] = useState<QuoteStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Add line item form
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItem, setNewItem] = useState({
    item_type: "material",
    description: "",
    product_id: "",
    style: "",
    color: "",
    finish: "",
    quantity: "1",
    unit: "each",
    unit_price: "",
  })

  // Add labor form
  const [showAddLabor, setShowAddLabor] = useState(false)
  const [newLabor, setNewLabor] = useState({
    description: "",
    hours: "",
    hourly_rate: "",
  })

  async function fetchQuote() {
    try {
      const res = await fetch(`${API_BASE}/quotes/${quoteId}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`Failed to load quote (${res.status})`)
      const data: Quote = await res.json()
      setQuote(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load quote"
      setError(message)
    }
  }

  async function fetchProducts() {
    try {
      const res = await fetch(`${API_BASE}/products/?limit=200`, { cache: "no-store" })
      if (!res.ok) return
      const data: Product[] = await res.json()
      setProducts(data)
    } catch (err) {
      console.error("Failed to load products:", err)
    }
  }

  async function fetchAllowedStatuses() {
    try {
      const res = await fetch(`${API_BASE}/quotes/${quoteId}/allowed-statuses`, { cache: "no-store" })
      if (!res.ok) return
      const data: QuoteStatus[] = await res.json()
      setAllowedStatuses(data)
    } catch (err) {
      console.error("Failed to load allowed statuses:", err)
    }
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      await Promise.all([fetchQuote(), fetchProducts()])
      await fetchAllowedStatuses()
      setLoading(false)
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId])

  async function handleStatusChange(newStatus: QuoteStatus) {
    try {
      setSaving(true)
      setError(null)

      const res = await fetch(`${API_BASE}/quotes/${quoteId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || "Failed to update status")
      }

      await fetchQuote()
      await fetchAllowedStatuses()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update status"
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddLineItem() {
    try {
      setSaving(true)
      setError(null)

      const res = await fetch(`${API_BASE}/quotes/${quoteId}/line-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_type: newItem.item_type,
          description: newItem.description,
          product_id: newItem.product_id ? parseInt(newItem.product_id, 10) : null,
          style: newItem.style || null,
          color: newItem.color || null,
          finish: newItem.finish || null,
          quantity: parseFloat(newItem.quantity) || 1,
          unit: newItem.unit || "each",
          unit_price: parseFloat(newItem.unit_price) || 0,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || "Failed to add line item")
      }

      await fetchQuote()
      setShowAddItem(false)
      setNewItem({
        item_type: "material",
        description: "",
        product_id: "",
        style: "",
        color: "",
        finish: "",
        quantity: "1",
        unit: "each",
        unit_price: "",
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add line item"
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveLineItem(index: number) {
    try {
      setSaving(true)
      const res = await fetch(`${API_BASE}/quotes/${quoteId}/line-items/${index}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to remove line item")
      await fetchQuote()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove line item"
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddLaborItem() {
    try {
      setSaving(true)
      setError(null)

      const res = await fetch(`${API_BASE}/quotes/${quoteId}/labor-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: newLabor.description,
          hours: parseFloat(newLabor.hours) || 0,
          hourly_rate: parseFloat(newLabor.hourly_rate) || 0,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || "Failed to add labor item")
      }

      await fetchQuote()
      setShowAddLabor(false)
      setNewLabor({ description: "", hours: "", hourly_rate: "" })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add labor item"
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveLaborItem(index: number) {
    try {
      setSaving(true)
      const res = await fetch(`${API_BASE}/quotes/${quoteId}/labor-items/${index}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to remove labor item")
      await fetchQuote()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove labor item"
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRecalculate() {
    try {
      setSaving(true)
      const res = await fetch(`${API_BASE}/quotes/${quoteId}/recalculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error("Failed to recalculate")
      await fetchQuote()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to recalculate"
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateJob() {
    try {
      setSaving(true)
      setError(null)

      const res = await fetch(`${API_BASE}/quotes/${quoteId}/create-job`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || "Failed to create job")
      }

      const result = await res.json()
      router.push(`/jobs/${result.job_id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create job"
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  // When product is selected, populate fields
  function handleProductSelect(productId: string) {
    setNewItem((prev) => ({ ...prev, product_id: productId }))
    const product = products.find((p) => p.id === parseInt(productId, 10))
    if (product) {
      setNewItem((prev) => ({
        ...prev,
        description: product.name,
        unit_price: product.base_price?.toString() || "",
        unit: product.unit || "each",
      }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-neutral-400">Loading quote…</p>
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <p className="text-red-400">Quote not found</p>
        <Link href="/quotes" className="mt-4 text-amber-400 hover:underline">
          ← Back to Quotes
        </Link>
      </div>
    )
  }

  const selectedProduct = newItem.product_id
    ? products.find((p) => p.id === parseInt(newItem.product_id, 10))
    : null

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white">Quote #{quote.id}</h1>
            <span
              className={`rounded-full border px-3 py-1 text-sm font-medium ${
                STATUS_COLORS[(quote.status as QuoteStatus) || "draft"]
              }`}
            >
              {STATUS_LABELS[(quote.status as QuoteStatus) || "draft"]}
            </span>
          </div>
          <p className="text-sm text-neutral-400">
            {quote.homeowner_name || quote.lead_name || "No customer assigned"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRecalculate}
            disabled={saving}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
          >
            Recalculate
          </button>
          <Link
            href="/quotes"
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            ← Back to Quotes
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
          {/* Line Items */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Materials & Line Items
              </h2>
              <button
                onClick={() => setShowAddItem(true)}
                className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-amber-400"
              >
                + Add Item
              </button>
            </div>

            {quote.line_items && quote.line_items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-left text-xs text-slate-500">
                      <th className="pb-2">Description</th>
                      <th className="pb-2">Style/Color</th>
                      <th className="pb-2 text-right">Qty</th>
                      <th className="pb-2 text-right">Unit Price</th>
                      <th className="pb-2 text-right">Total</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.line_items.map((item, index) => (
                      <tr key={index} className="border-b border-slate-800">
                        <td className="py-2">
                          <p className="text-white">{item.description}</p>
                          {item.sku && <p className="text-xs text-slate-500">SKU: {item.sku}</p>}
                        </td>
                        <td className="py-2 text-slate-400">
                          {[item.style, item.color, item.finish].filter(Boolean).join(" / ") || "—"}
                        </td>
                        <td className="py-2 text-right text-white">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-2 text-right text-white">${item.unit_price.toFixed(2)}</td>
                        <td className="py-2 text-right font-medium text-amber-400">
                          ${item.total.toFixed(2)}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => handleRemoveLineItem(index)}
                            disabled={saving}
                            className="text-red-400 hover:text-red-300 disabled:opacity-50"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No line items added yet</p>
            )}

            {/* Add Item Form */}
            {showAddItem && (
              <div className="mt-4 rounded-md border border-slate-700 bg-slate-800/50 p-4">
                <h3 className="mb-3 text-sm font-medium text-white">Add Line Item</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-400">Product (optional)</label>
                    <select
                      value={newItem.product_id}
                      onChange={(e) => handleProductSelect(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      <option value="">Select product...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} - ${p.base_price?.toFixed(2) || "0.00"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Type</label>
                    <select
                      value={newItem.item_type}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, item_type: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      <option value="material">Material</option>
                      <option value="adjustment">Adjustment</option>
                      <option value="discount">Discount</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-slate-400">Description</label>
                    <input
                      value={newItem.description}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, description: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
                      placeholder="Item description"
                    />
                  </div>
                  {selectedProduct && (
                    <>
                      <div>
                        <label className="text-xs text-slate-400">Style</label>
                        <select
                          value={newItem.style}
                          onChange={(e) => setNewItem((prev) => ({ ...prev, style: e.target.value }))}
                          className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
                        >
                          <option value="">Select style...</option>
                          {selectedProduct.available_styles?.map((s) => (
                            <option key={s} value={s}>
                              {s.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400">Color</label>
                        <select
                          value={newItem.color}
                          onChange={(e) => setNewItem((prev) => ({ ...prev, color: e.target.value }))}
                          className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
                        >
                          <option value="">Select color...</option>
                          {selectedProduct.available_colors?.map((c) => (
                            <option key={c} value={c}>
                              {c.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                  <div>
                    <label className="text-xs text-slate-400">Quantity</label>
                    <input
                      type="number"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, quantity: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
                      min="0"
                      step="1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Unit Price ($)</label>
                    <input
                      type="number"
                      value={newItem.unit_price}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, unit_price: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleAddLineItem}
                    disabled={saving || !newItem.description}
                    className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400 disabled:opacity-50"
                  >
                    {saving ? "Adding…" : "Add Item"}
                  </button>
                  <button
                    onClick={() => setShowAddItem(false)}
                    className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Labor Items */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Labor
              </h2>
              <button
                onClick={() => setShowAddLabor(true)}
                className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-emerald-400"
              >
                + Add Labor
              </button>
            </div>

            {quote.labor_items && quote.labor_items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-left text-xs text-slate-500">
                      <th className="pb-2">Description</th>
                      <th className="pb-2">Installer</th>
                      <th className="pb-2 text-right">Hours</th>
                      <th className="pb-2 text-right">Rate</th>
                      <th className="pb-2 text-right">Total</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.labor_items.map((item, index) => (
                      <tr key={index} className="border-b border-slate-800">
                        <td className="py-2 text-white">{item.description}</td>
                        <td className="py-2 text-slate-400">{item.installer_name || "—"}</td>
                        <td className="py-2 text-right text-white">{item.hours}h</td>
                        <td className="py-2 text-right text-white">${item.hourly_rate.toFixed(2)}/hr</td>
                        <td className="py-2 text-right font-medium text-emerald-400">
                          ${item.total.toFixed(2)}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => handleRemoveLaborItem(index)}
                            disabled={saving}
                            className="text-red-400 hover:text-red-300 disabled:opacity-50"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No labor items added yet</p>
            )}

            {/* Add Labor Form */}
            {showAddLabor && (
              <div className="mt-4 rounded-md border border-slate-700 bg-slate-800/50 p-4">
                <h3 className="mb-3 text-sm font-medium text-white">Add Labor</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-3">
                    <label className="text-xs text-slate-400">Description</label>
                    <input
                      value={newLabor.description}
                      onChange={(e) => setNewLabor((prev) => ({ ...prev, description: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
                      placeholder="e.g., Installation labor"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Hours</label>
                    <input
                      type="number"
                      value={newLabor.hours}
                      onChange={(e) => setNewLabor((prev) => ({ ...prev, hours: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
                      min="0"
                      step="0.5"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Hourly Rate ($)</label>
                    <input
                      type="number"
                      value={newLabor.hourly_rate}
                      onChange={(e) => setNewLabor((prev) => ({ ...prev, hourly_rate: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleAddLaborItem}
                    disabled={saving || !newLabor.description}
                    className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {saving ? "Adding…" : "Add Labor"}
                  </button>
                  <button
                    onClick={() => setShowAddLabor(false)}
                    className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Cost Summary */}
          <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-amber-400">
              Cost Summary
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Materials</span>
                <span className="text-white">${quote.materials_subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Labor</span>
                <span className="text-white">${quote.labor_subtotal.toFixed(2)}</span>
              </div>
              {quote.adjustments_total > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Adjustments</span>
                  <span className="text-white">${quote.adjustments_total.toFixed(2)}</span>
                </div>
              )}
              {quote.discount_total > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Discounts</span>
                  <span className="text-red-400">-${quote.discount_total.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-slate-700 pt-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Subtotal</span>
                  <span className="text-white">
                    ${(quote.materials_subtotal + quote.labor_subtotal + quote.adjustments_total - quote.discount_total).toFixed(2)}
                  </span>
                </div>
              </div>
              {quote.tax_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Tax ({(quote.tax_rate * 100).toFixed(1)}%)</span>
                  <span className="text-white">${quote.tax_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-amber-700 pt-2">
                <div className="flex justify-between text-lg font-semibold">
                  <span className="text-amber-400">Total</span>
                  <span className="text-amber-300">${quote.total_price.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status Workflow */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Status Workflow
            </h2>
            <div className="mb-4">
              <p className="text-xs text-neutral-500 mb-2">Current Status</p>
              <span
                className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${
                  STATUS_COLORS[(quote.status as QuoteStatus) || "draft"]
                }`}
              >
                {STATUS_LABELS[(quote.status as QuoteStatus) || "draft"]}
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

            {/* Create Job Button */}
            {quote.status === "approved" && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-xs text-neutral-500 mb-2">Actions</p>
                <button
                  onClick={handleCreateJob}
                  disabled={saving}
                  className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {saving ? "Creating Job..." : "Create Job"}
                </button>
              </div>
            )}
          </div>

          {/* Quote Info */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Quote Info
            </h2>
            <div className="space-y-3 text-sm">
              {quote.homeowner_id && (
                <div>
                  <p className="text-xs text-neutral-500">Homeowner</p>
                  <Link
                    href={`/homeowners/${quote.homeowner_id}`}
                    className="text-amber-400 hover:underline"
                  >
                    {quote.homeowner_name || `#${quote.homeowner_id}`}
                  </Link>
                </div>
              )}
              {quote.lead_id && (
                <div>
                  <p className="text-xs text-neutral-500">Lead</p>
                  <Link href={`/leads`} className="text-amber-400 hover:underline">
                    {quote.lead_name || `#${quote.lead_id}`}
                  </Link>
                </div>
              )}
              {quote.valid_until && (
                <div>
                  <p className="text-xs text-neutral-500">Valid Until</p>
                  <p className="text-white">{new Date(quote.valid_until).toLocaleDateString()}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-neutral-500">Created</p>
                <p className="text-white">
                  {quote.created_at ? new Date(quote.created_at).toLocaleString() : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Last Updated</p>
                <p className="text-white">
                  {quote.updated_at ? new Date(quote.updated_at).toLocaleString() : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
