// TODO: reconnect to Postgres/Supabase when backend is available.
"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { mockSuppliers } from "@/app/lib/mockData";
import type { Supplier } from "@/app/lib/mockData";
import { DetailField, DetailModal } from "@/components/ui/detail-modal";

const STATUS_COLORS: Record<Supplier["status"], string> = {
  active: "bg-cyber-green/10 border-cyber-green/50 text-cyber-green",
  delayed: "bg-cyber-red/10 border-cyber-red/50 text-cyber-red",
  inactive: "bg-textMuted/20 border-textMuted/50 text-textMuted",
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      {label}
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

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const suppliers = mockSuppliers;

  const filtered = useMemo(() => {
    if (!search) return suppliers;
    const s = search.toLowerCase();
    return suppliers.filter((sup) =>
      sup.name.toLowerCase().includes(s) || sup.materialCategory.toLowerCase().includes(s)
    );
  }, [suppliers, search]);

  const activeCount = suppliers.filter((s) => s.status === "active").length;
  const delayedCount = suppliers.filter((s) => s.status === "delayed").length;
  const totalOpenOrders = suppliers.reduce((sum, s) => sum + s.openOrders, 0);
  const avgFulfillment = Math.round(suppliers.reduce((sum, s) => sum + s.fulfillmentRate, 0) / suppliers.length);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-cyber-cyan" style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}>
            Suppliers
          </h1>
          <p className="text-sm text-textSecondary font-mono">// Supplier network, fulfillment status, and open material orders</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Active Suppliers" value={activeCount} variant="cyan" />
          <KpiCard label="Avg Fulfillment" value={`${avgFulfillment}%`} variant="green" />
          <KpiCard label="Open Orders" value={totalOpenOrders} variant="yellow" />
          <KpiCard label="Delayed" value={delayedCount} variant="red" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search supplier or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 border border-borderSubtle bg-surface px-3 py-2 text-xs text-textPrimary placeholder-textMuted focus:border-cyber-cyan/60 focus:outline-none font-mono"
          />
          <span className="text-xs text-textMuted font-mono">{filtered.length} / {suppliers.length} records</span>
        </div>

        <section className="cyber-card-tw border-l-4 border-l-cyber-cyan shadow-cyberInset overflow-x-auto p-0">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-borderSubtle bg-bgDark">
                {["ID", "Supplier", "Material Category", "Fulfillment Rate", "Open Orders", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-display text-[10px] uppercase tracking-[0.15em] text-cyber-cyan/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((sup) => (
                <tr
                  key={sup.id}
                  className="cursor-pointer border-b border-borderSubtle transition-colors hover:bg-surface/60"
                  onClick={() => setSelectedSupplier(sup)}
                >
                  <td className="px-4 py-3 font-mono text-textMuted">{sup.id}</td>
                  <td className="px-4 py-3 font-medium text-textPrimary">{sup.name}</td>
                  <td className="px-4 py-3 text-textSecondary">{sup.materialCategory}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-bgLighter overflow-hidden">
                        <div className="h-full rounded-full bg-cyber-green" style={{ width: `${sup.fulfillmentRate}%`, opacity: 0.8 }} />
                      </div>
                      <span className={`font-mono font-bold ${sup.fulfillmentRate >= 95 ? "text-cyber-green" : sup.fulfillmentRate >= 90 ? "text-cyber-yellow" : "text-cyber-red"}`}>
                        {sup.fulfillmentRate}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-cyber-cyan font-bold">{sup.openOrders}</td>
                  <td className="px-4 py-3"><Badge label={sup.status} colorClass={STATUS_COLORS[sup.status]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      {selectedSupplier ? (
        <DetailModal
          title={`Supplier Card — ${selectedSupplier.name}`}
          subtitle={selectedSupplier.id}
          onClose={() => setSelectedSupplier(null)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Supplier" value={selectedSupplier.name} />
            <DetailField label="Material Category" value={selectedSupplier.materialCategory} />
            <DetailField label="Status" value={selectedSupplier.status} />
            <DetailField label="Open Orders" value={selectedSupplier.openOrders} />
            <DetailField label="Fulfillment Rate" value={`${selectedSupplier.fulfillmentRate}%`} />
          </div>
        </DetailModal>
      ) : null}
    </DashboardShell>
  );
}
