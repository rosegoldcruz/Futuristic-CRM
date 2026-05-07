// TODO: reconnect to Postgres/Supabase when backend is available.
"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { mockHomeowners } from "@/app/lib/mockData";
import type { Homeowner } from "@/app/lib/mockData";
import { DetailField, DetailModal } from "@/components/ui/detail-modal";

const STATUS_COLORS: Record<Homeowner["status"], string> = {
  active: "bg-cyber-cyan/10 border-cyber-cyan/50 text-cyber-cyan",
  completed: "bg-cyber-green/10 border-cyber-green/50 text-cyber-green",
  prospecting: "bg-cyber-yellow/10 border-cyber-yellow/50 text-cyber-yellow",
  "on-hold": "bg-cyber-red/10 border-cyber-red/50 text-cyber-red",
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      {label}
    </span>
  );
}

function KpiCard({ label, value, variant = "cyan" }: { label: string; value: string | number; variant?: "cyan" | "green" | "yellow" | "magenta" }) {
  const colors = {
    cyan: { border: "border-cyber-cyan/30", text: "text-cyber-cyan", glow: "rgba(0,240,255,0.5)" },
    green: { border: "border-cyber-green/30", text: "text-cyber-green", glow: "rgba(0,255,102,0.5)" },
    yellow: { border: "border-cyber-yellow/30", text: "text-cyber-yellow", glow: "rgba(255,230,0,0.5)" },
    magenta: { border: "border-cyber-magenta/30", text: "text-cyber-magenta", glow: "rgba(255,0,255,0.5)" },
  };
  const c = colors[variant];
  return (
    <div className={`cyber-card-tw ${c.border} shadow-cyberInset`}>
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-textMuted">// {label}</p>
      <p className={`mt-2 text-2xl font-bold font-display ${c.text}`} style={{ textShadow: `0 0 15px ${c.glow}` }}>{value}</p>
    </div>
  );
}

export default function HomeownersPage() {
  const [search, setSearch] = useState("");
  const [selectedHomeowner, setSelectedHomeowner] = useState<Homeowner | null>(null);
  const homeowners = mockHomeowners;

  const filtered = useMemo(() => {
    if (!search) return homeowners;
    const s = search.toLowerCase();
    return homeowners.filter((h) =>
      h.name.toLowerCase().includes(s) || h.city.toLowerCase().includes(s) || h.email.toLowerCase().includes(s)
    );
  }, [homeowners, search]);

  const activeCount = homeowners.filter((h) => h.status === "active").length;
  const completedCount = homeowners.filter((h) => h.status === "completed").length;
  const prospectingCount = homeowners.filter((h) => h.status === "prospecting").length;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-cyber-cyan" style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}>
            Homeowners
          </h1>
          <p className="text-sm text-textSecondary font-mono">// Customer records and project history</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total Homeowners" value={homeowners.length} variant="cyan" />
          <KpiCard label="Active Projects" value={activeCount} variant="green" />
          <KpiCard label="Completed" value={completedCount} variant="magenta" />
          <KpiCard label="Prospecting" value={prospectingCount} variant="yellow" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search name, city, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 border border-borderSubtle bg-surface px-3 py-2 text-xs text-textPrimary placeholder-textMuted focus:border-cyber-cyan/60 focus:outline-none font-mono"
          />
          <span className="text-xs text-textMuted font-mono">{filtered.length} / {homeowners.length} records</span>
        </div>

        <section className="cyber-card-tw border-l-4 border-l-cyber-cyan shadow-cyberInset overflow-x-auto p-0">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-borderSubtle bg-bgDark">
                {["ID", "Name", "City", "Phone", "Email", "Active Project", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-display text-[10px] uppercase tracking-[0.15em] text-cyber-cyan/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((ho) => (
                <tr
                  key={ho.id}
                  className="cursor-pointer border-b border-borderSubtle transition-colors hover:bg-surface/60"
                  onClick={() => setSelectedHomeowner(ho)}
                >
                  <td className="px-4 py-3 font-mono text-textMuted">{ho.id}</td>
                  <td className="px-4 py-3 font-medium text-textPrimary">{ho.name}</td>
                  <td className="px-4 py-3 text-textSecondary">{ho.city}</td>
                  <td className="px-4 py-3 text-textSecondary font-mono">{ho.phone}</td>
                  <td className="px-4 py-3 text-textMuted">{ho.email}</td>
                  <td className="px-4 py-3 text-textSecondary">{ho.activeProject}</td>
                  <td className="px-4 py-3"><Badge label={ho.status} colorClass={STATUS_COLORS[ho.status]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      {selectedHomeowner ? (
        <DetailModal
          title={`Homeowner Card — ${selectedHomeowner.name}`}
          subtitle={selectedHomeowner.id}
          onClose={() => setSelectedHomeowner(null)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Name" value={selectedHomeowner.name} />
            <DetailField label="City" value={selectedHomeowner.city} />
            <DetailField label="Phone" value={selectedHomeowner.phone} />
            <DetailField label="Email" value={selectedHomeowner.email} />
            <DetailField label="Active Project" value={selectedHomeowner.activeProject} />
            <DetailField label="Status" value={selectedHomeowner.status} />
          </div>
        </DetailModal>
      ) : null}
    </DashboardShell>
  );
}
