// TODO: reconnect to Postgres/Supabase when backend is available.
"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { mockInstallers } from "@/app/lib/mockData";
import type { Installer } from "@/app/lib/mockData";
import { DetailField, DetailModal } from "@/components/ui/detail-modal";

const AVAIL_COLORS: Record<Installer["availability"], string> = {
  available: "bg-cyber-green/10 border-cyber-green/50 text-cyber-green",
  busy: "bg-cyber-yellow/10 border-cyber-yellow/50 text-cyber-yellow",
  unavailable: "bg-cyber-red/10 border-cyber-red/50 text-cyber-red",
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

export default function InstallersPage() {
  const [search, setSearch] = useState("");
  const [selectedInstaller, setSelectedInstaller] = useState<Installer | null>(null);
  const installers = mockInstallers;

  const filtered = useMemo(() => {
    if (!search) return installers;
    const s = search.toLowerCase();
    return installers.filter((i) =>
      i.name.toLowerCase().includes(s) || i.coverageArea.toLowerCase().includes(s)
    );
  }, [installers, search]);

  const availableCount = installers.filter((i) => i.availability === "available").length;
  const busyCount = installers.filter((i) => i.availability === "busy").length;
  const totalActiveJobs = installers.reduce((sum, i) => sum + i.activeJobs, 0);
  const avgSla = Math.round(installers.reduce((sum, i) => sum + i.slaScore, 0) / installers.length);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-cyber-cyan" style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}>
            Installers
          </h1>
          <p className="text-sm text-textSecondary font-mono">// Installer partner network, availability, SLA, and active jobs</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total Partners" value={installers.length} variant="cyan" />
          <KpiCard label="Available Now" value={availableCount} variant="green" />
          <KpiCard label="Currently Busy" value={busyCount} variant="yellow" />
          <KpiCard label="Avg SLA Score" value={`${avgSla}%`} variant="magenta" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search name or coverage area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 border border-borderSubtle bg-surface px-3 py-2 text-xs text-textPrimary placeholder-textMuted focus:border-cyber-cyan/60 focus:outline-none font-mono"
          />
          <span className="text-xs text-textMuted font-mono">{filtered.length} / {installers.length} installers</span>
        </div>

        <section className="cyber-card-tw border-l-4 border-l-cyber-cyan shadow-cyberInset overflow-x-auto p-0">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-borderSubtle bg-bgDark">
                {["ID", "Company", "Coverage Area", "Availability", "Active Jobs", "SLA Score", "Rating"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-display text-[10px] uppercase tracking-[0.15em] text-cyber-cyan/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((ins) => (
                <tr
                  key={ins.id}
                  className="cursor-pointer border-b border-borderSubtle transition-colors hover:bg-surface/60"
                  onClick={() => setSelectedInstaller(ins)}
                >
                  <td className="px-4 py-3 font-mono text-textMuted">{ins.id}</td>
                  <td className="px-4 py-3 font-medium text-textPrimary">{ins.name}</td>
                  <td className="px-4 py-3 text-textSecondary">{ins.coverageArea}</td>
                  <td className="px-4 py-3"><Badge label={ins.availability} colorClass={AVAIL_COLORS[ins.availability]} /></td>
                  <td className="px-4 py-3 font-mono text-cyber-cyan font-bold">{ins.activeJobs}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-bgLighter overflow-hidden">
                        <div className="h-full rounded-full bg-cyber-green" style={{ width: `${ins.slaScore}%`, opacity: 0.8 }} />
                      </div>
                      <span className={`font-mono font-bold ${ins.slaScore >= 95 ? "text-cyber-green" : ins.slaScore >= 90 ? "text-cyber-yellow" : "text-cyber-red"}`}>
                        {ins.slaScore}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-cyber-yellow font-bold">★ {ins.rating.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      {selectedInstaller ? (
        <DetailModal
          title={`Installer Card — ${selectedInstaller.name}`}
          subtitle={selectedInstaller.id}
          onClose={() => setSelectedInstaller(null)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Company" value={selectedInstaller.name} />
            <DetailField label="Coverage Area" value={selectedInstaller.coverageArea} />
            <DetailField label="Availability" value={selectedInstaller.availability} />
            <DetailField label="Status" value={selectedInstaller.status} />
            <DetailField label="Active Jobs" value={selectedInstaller.activeJobs} />
            <DetailField label="SLA Score" value={`${selectedInstaller.slaScore}%`} />
            <DetailField label="Rating" value={`★ ${selectedInstaller.rating.toFixed(1)}`} />
          </div>
        </DetailModal>
      ) : null}
    </DashboardShell>
  );
}
