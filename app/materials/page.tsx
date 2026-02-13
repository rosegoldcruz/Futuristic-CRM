"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type ProductVariant = {
  sku: string
  name: string
  style?: string | null
  color?: string | null
  finish?: string | null
  price?: number | null
  in_stock: boolean
}

type Product = {
  id: number
  tenant_id?: number | null
  supplier_id: number
  supplier_name?: string | null
  name: string
  description?: string | null
  category: string
  sku_prefix?: string | null
  base_price?: number | null
  base_cost?: number | null
  unit?: string | null
  status?: string | null
  available_styles?: string[] | null
  available_colors?: string[] | null
  available_finishes?: string[] | null
  variants?: ProductVariant[] | null
  specifications?: Record<string, unknown> | null
  images?: string[] | null
  created_at?: string | null
}

type Supplier = {
  id: number
  company_name: string
  is_active?: boolean
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

const CATEGORY_LABELS: Record<string, string> = {
  doors: "Cabinet Doors",
  panels: "Panels",
  hardware: "Hardware",
  accessories: "Accessories",
  finishes: "Finishes",
  other: "Other",
}

const CATEGORY_COLORS: Record<string, string> = {
  doors: "bg-blue-500/20 text-blue-300 border-blue-500/50",
  panels: "bg-purple-500/20 text-purple-300 border-purple-500/50",
  hardware: "bg-amber-500/20 text-amber-300 border-amber-500/50",
  accessories: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  finishes: "bg-pink-500/20 text-pink-300 border-pink-500/50",
  other: "bg-neutral-500/20 text-neutral-300 border-neutral-500/50",
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-300",
  discontinued: "bg-red-500/20 text-red-300",
  out_of_stock: "bg-yellow-500/20 text-yellow-300",
  coming_soon: "bg-blue-500/20 text-blue-300",
}

export default function MaterialsCatalogPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [supplierFilter, setSupplierFilter] = useState("")
  const [styleFilter, setStyleFilter] = useState("")
  const [colorFilter, setColorFilter] = useState("")

  // Available options for filters
  const [availableOptions, setAvailableOptions] = useState<{
    styles: string[]
    colors: string[]
    finishes: string[]
  }>({ styles: [], colors: [], finishes: [] })

  // Selected product for detail view
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  async function fetchProducts() {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (search.trim()) params.set("search", search.trim())
      if (categoryFilter) params.set("category", categoryFilter)
      if (supplierFilter) params.set("supplier_id", supplierFilter)
      if (styleFilter) params.set("style", styleFilter)
      if (colorFilter) params.set("color", colorFilter)

      const res = await fetch(`${API_BASE}/products/?${params.toString()}`, {
        cache: "no-store",
      })
      if (!res.ok) throw new Error(`Failed to load products (${res.status})`)
      const data: Product[] = await res.json()
      setProducts(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load products"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchSuppliers() {
    try {
      const res = await fetch(`${API_BASE}/suppliers/`, { cache: "no-store" })
      if (!res.ok) return
      const data: Supplier[] = await res.json()
      setSuppliers(data)
    } catch (err) {
      console.error("Failed to load suppliers:", err)
    }
  }

  async function fetchOptions() {
    try {
      const res = await fetch(`${API_BASE}/products/options`, { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      setAvailableOptions(data)
    } catch (err) {
      console.error("Failed to load options:", err)
    }
  }

  useEffect(() => {
    Promise.all([fetchProducts(), fetchSuppliers(), fetchOptions()])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, supplierFilter, styleFilter, colorFilter])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    fetchProducts()
  }

  // Group products by category
  const productsByCategory = products.reduce((acc, product) => {
    const cat = product.category || "other"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(product)
    return acc
  }, {} as Record<string, Product[]>)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Materials Catalog</h1>
          <p className="text-sm text-neutral-400">
            Browse products, styles, colors, and finishes from your suppliers
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-48 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="submit"
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400"
          >
            Search
          </button>
        </form>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="">All Categories</option>
          <option value="doors">Cabinet Doors</option>
          <option value="panels">Panels</option>
          <option value="hardware">Hardware</option>
          <option value="accessories">Accessories</option>
          <option value="finishes">Finishes</option>
          <option value="other">Other</option>
        </select>

        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="">All Suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.company_name}
            </option>
          ))}
        </select>

        {availableOptions.styles.length > 0 && (
          <select
            value={styleFilter}
            onChange={(e) => setStyleFilter(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Styles</option>
            {availableOptions.styles.map((style) => (
              <option key={style} value={style}>
                {style.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        )}

        {availableOptions.colors.length > 0 && (
          <select
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Colors</option>
            {availableOptions.colors.map((color) => (
              <option key={color} value={color}>
                {color.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        )}

        {(categoryFilter || supplierFilter || styleFilter || colorFilter || search) && (
          <button
            onClick={() => {
              setCategoryFilter("")
              setSupplierFilter("")
              setStyleFilter("")
              setColorFilter("")
              setSearch("")
            }}
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Clear Filters
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-800 bg-red-950 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Total Products
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">{products.length}</p>
        </div>
        <div className="rounded-lg border border-blue-900/50 bg-blue-950/30 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-blue-400">Doors</p>
          <p className="mt-1 text-2xl font-semibold text-blue-300">
            {products.filter((p) => p.category === "doors").length}
          </p>
        </div>
        <div className="rounded-lg border border-purple-900/50 bg-purple-950/30 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-purple-400">Panels</p>
          <p className="mt-1 text-2xl font-semibold text-purple-300">
            {products.filter((p) => p.category === "panels").length}
          </p>
        </div>
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-400">Hardware</p>
          <p className="mt-1 text-2xl font-semibold text-amber-300">
            {products.filter((p) => p.category === "hardware").length}
          </p>
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-neutral-400">Loading products…</p>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-neutral-500">No products found</p>
          <p className="text-sm text-neutral-600">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
            <section key={category}>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                <span
                  className={`inline-block rounded-full border px-3 py-1 text-xs ${
                    CATEGORY_COLORS[category] || CATEGORY_COLORS.other
                  }`}
                >
                  {CATEGORY_LABELS[category] || category}
                </span>
                <span className="text-sm text-neutral-500">({categoryProducts.length})</span>
              </h2>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {categoryProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className="cursor-pointer rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 transition hover:border-amber-500/50 hover:bg-neutral-800/50"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-white">{product.name}</h3>
                        <p className="text-xs text-neutral-500">{product.supplier_name}</p>
                      </div>
                      {product.status && (
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] capitalize ${
                            STATUS_COLORS[product.status] || STATUS_COLORS.active
                          }`}
                        >
                          {product.status}
                        </span>
                      )}
                    </div>

                    {product.description && (
                      <p className="mb-3 text-xs text-neutral-400 line-clamp-2">
                        {product.description}
                      </p>
                    )}

                    <div className="mb-3 flex items-baseline gap-2">
                      {product.base_price && (
                        <span className="text-lg font-semibold text-amber-400">
                          ${product.base_price.toFixed(2)}
                        </span>
                      )}
                      {product.unit && (
                        <span className="text-xs text-neutral-500">/ {product.unit}</span>
                      )}
                    </div>

                    {/* Available Options Preview */}
                    <div className="space-y-2">
                      {product.available_styles && product.available_styles.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {product.available_styles.slice(0, 3).map((style) => (
                            <span
                              key={style}
                              className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300"
                            >
                              {style.replace(/_/g, " ")}
                            </span>
                          ))}
                          {product.available_styles.length > 3 && (
                            <span className="text-[10px] text-neutral-500">
                              +{product.available_styles.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                      {product.available_colors && product.available_colors.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {product.available_colors.slice(0, 4).map((color) => (
                            <span
                              key={color}
                              className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300"
                            >
                              {color.replace(/_/g, " ")}
                            </span>
                          ))}
                          {product.available_colors.length > 4 && (
                            <span className="text-[10px] text-neutral-500">
                              +{product.available_colors.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {product.sku_prefix && (
                      <p className="mt-3 text-[10px] text-neutral-600">SKU: {product.sku_prefix}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-neutral-800 bg-neutral-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-white">{selectedProduct.name}</h2>
                <p className="text-sm text-neutral-400">{selectedProduct.supplier_name}</p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 p-6">
              {/* Price & Category */}
              <div className="flex items-center gap-4">
                {selectedProduct.base_price && (
                  <span className="text-2xl font-bold text-amber-400">
                    ${selectedProduct.base_price.toFixed(2)}
                    {selectedProduct.unit && (
                      <span className="text-sm font-normal text-neutral-500">
                        {" "}
                        / {selectedProduct.unit}
                      </span>
                    )}
                  </span>
                )}
                <span
                  className={`rounded-full border px-3 py-1 text-xs ${
                    CATEGORY_COLORS[selectedProduct.category] || CATEGORY_COLORS.other
                  }`}
                >
                  {CATEGORY_LABELS[selectedProduct.category] || selectedProduct.category}
                </span>
                {selectedProduct.status && (
                  <span
                    className={`rounded px-2 py-0.5 text-xs capitalize ${
                      STATUS_COLORS[selectedProduct.status] || STATUS_COLORS.active
                    }`}
                  >
                    {selectedProduct.status}
                  </span>
                )}
              </div>

              {/* Description */}
              {selectedProduct.description && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-neutral-400">Description</h3>
                  <p className="text-sm text-neutral-300">{selectedProduct.description}</p>
                </div>
              )}

              {/* Available Styles */}
              {selectedProduct.available_styles && selectedProduct.available_styles.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-neutral-400">Available Styles</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.available_styles.map((style) => (
                      <span
                        key={style}
                        className="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-slate-200"
                      >
                        {style.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Colors */}
              {selectedProduct.available_colors && selectedProduct.available_colors.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-neutral-400">Available Colors</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.available_colors.map((color) => (
                      <span
                        key={color}
                        className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200"
                      >
                        {color.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Finishes */}
              {selectedProduct.available_finishes &&
                selectedProduct.available_finishes.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-neutral-400">
                      Available Finishes
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedProduct.available_finishes.map((finish) => (
                        <span
                          key={finish}
                          className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200"
                        >
                          {finish.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* SKU */}
              {selectedProduct.sku_prefix && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-neutral-400">SKU Prefix</h3>
                  <p className="font-mono text-sm text-neutral-300">{selectedProduct.sku_prefix}</p>
                </div>
              )}

              {/* Specifications */}
              {selectedProduct.specifications &&
                Object.keys(selectedProduct.specifications).length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-neutral-400">Specifications</h3>
                    <pre className="rounded-md bg-neutral-900 p-3 text-xs text-neutral-400">
                      {JSON.stringify(selectedProduct.specifications, null, 2)}
                    </pre>
                  </div>
                )}
            </div>

            <div className="flex justify-end gap-3 border-t border-neutral-800 px-6 py-4">
              <button
                onClick={() => setSelectedProduct(null)}
                className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
