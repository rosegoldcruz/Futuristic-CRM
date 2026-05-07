// TODO: reconnect to Postgres/Supabase when backend is available.
"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { mockMaterials } from "@/app/lib/mockData";
import type { Material } from "@/app/lib/mockData";
import { DetailField, DetailModal } from "@/components/ui/detail-modal";

const STOCK_COLORS: Record<Material["stockStatus"], string> = {
  "in-stock": "bg-cyber-green/10 border-cyber-green/50 text-cyber-green",
  "low-stock": "bg-cyber-yellow/10 border-cyber-yellow/50 text-cyber-yellow",
  "out-of-stock": "bg-cyber-red/10 border-cyber-red/50 text-cyber-red",
  "on-order": "bg-cyber-cyan/10 border-cyber-cyan/50 text-cyber-cyan",
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      {label.replace("-", " ")}
    </span>
  );
}

function KpiCard({ label, value, variant = "cyan" }: { label: string; value: string | number; variant?: "cyan" | "green" | "yellow" | "red" }) {
  const colors = {
    cyan: { border: "border-cyber-cyan/30", text: "text-cyber-cyan", glow: "rgba(0,240,255,0.5)" },
    green: { border: "border-cyber-green/30", text: "text-cyber-green", glow: "rgba(0,255,102,0.5)" },
    yellow: { border: "border-cyber-yellow/30", text: "text-cyber-yellow", glow: "rgba(255,230,0,0.5)" },
    red: { border: "border-cyber-red/30", text: "text-cyber-red", glow: "rgba(255,0,68,0.5)" },
  };
  const c = colors[variant];
  return (
    <div className={`cyber-card-tw ${c.border} shadow-cyberInset`}>
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-textMuted">// {label}</p>
      <p className={`mt-2 text-2xl font-bold font-display ${c.text}`} style={{ textShadow: `0 0 15px ${c.glow}` }}>{value}</p>
    </div>
  );
}

export default function MaterialsPage() {
  const [search, setSearch] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const materials = mockMaterials;

  const filtered = useMemo(() => {
    if (!search) return materials;
    const s = search.toLowerCase();
    return materials.filter((m) =>
      m.name.toLowerCase().includes(s) ||
      m.sku.toLowerCase().includes(s) ||
      m.category.toLowerCase().includes(s) ||
      m.supplier.toLowerCase().includes(s)
    );
  }, [materials, search]);

  const inStock = materials.filter((m) => m.stockStatus === "in-stock").length;
  const lowStock = materials.filter((m) => m.stockStatus === "low-stock").length;
  const outOfStock = materials.filter((m) => m.stockStatus === "out-of-stock").length;
  const onOrder = materials.filter((m) => m.stockStatus === "on-order").length;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-cyber-cyan" style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}>
            Materials
          </h1>
          <p className="text-sm text-textSecondary font-mono">// Material catalog, stock status, ETA, and supplier mapping</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="In Stock" value={inStock} variant="green" />
          <KpiCard label="Low Stock" value={lowStock} variant="yellow" />
          <KpiCard label="Out of Stock" value={outOfStock} variant="red" />
          <KpiCard label="On Order" value={onOrder} variant="cyan" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search SKU, name, category, supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 border border-borderSubtle bg-surface px-3 py-2 text-xs text-textPrimary placeholder-textMuted focus:border-cyber-cyan/60 focus:outline-none font-mono"
          />
          <span className="text-xs text-textMuted font-mono">{filtered.length} / {materials.length} items</span>
        </div>

        <section className="cyber-card-tw border-l-4 border-l-cyber-cyan shadow-cyberInset overflow-x-auto p-0">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-borderSubtle bg-bgDark">
                {["SKU", "Name", "Category", "Supplier", "Stock Status", "ETA"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-display text-[10px] uppercase tracking-[0.15em] text-cyber-cyan/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((mat) => (
                <tr
                  key={mat.sku}
                  className={`cursor-pointer border-b border-borderSubtle transition-colors hover:bg-surface/60 ${mat.stockStatus === "out-of-stock" ? "bg-cyber-red/5" : ""}`}
                  onClick={() => setSelectedMaterial(mat)}
                >
                  <td className="px-4 py-3 font-mono text-cyber-cyan">{mat.sku}</td>
                  <td className="px-4 py-3 font-medium text-textPrimary">{mat.name}</td>
                  <td className="px-4 py-3 text-textSecondary">{mat.category}</td>
                  <td className="px-4 py-3 text-textSecondary">{mat.supplier}</td>
                  <td className="px-4 py-3"><Badge label={mat.stockStatus} colorClass={STOCK_COLORS[mat.stockStatus]} /></td>
                  <td className="px-4 py-3 text-textMuted font-mono">{mat.eta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      {selectedMaterial ? (
        <DetailModal
          title={`Material Card — ${selectedMaterial.name}`}
          subtitle={selectedMaterial.sku}
          onClose={() => setSelectedMaterial(null)}
        >
          <div className="mb-3 border border-borderSubtle/80 bg-surface/40 p-3">
            <div className="flex h-40 items-center justify-center border border-cyber-cyan/40 bg-gradient-to-br from-cyber-cyan/10 via-surface to-cyber-magenta/10 text-center">
              <div>
                <p className="font-display text-sm font-bold uppercase tracking-wider text-cyber-cyan">Image Preview</p>
                <p className="mt-1 text-xs text-textSecondary">{selectedMaterial.imageLabel}</p>
                <p className="mt-2 text-xs font-mono text-cyber-yellow">{selectedMaterial.dimensions}</p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField label="SKU" value={selectedMaterial.sku} />
            <DetailField label="Name" value={selectedMaterial.name} />
            <DetailField label="Category" value={selectedMaterial.category} />
            <DetailField label="Supplier" value={selectedMaterial.supplier} />
            <DetailField label="Stock Status" value={selectedMaterial.stockStatus.replace("-", " ")} />
            <DetailField label="Dimensions" value={selectedMaterial.dimensions} />
            <DetailField label="ETA" value={selectedMaterial.eta} />
          </div>
        </DetailModal>
      ) : null}
    </DashboardShell>
  );
}
