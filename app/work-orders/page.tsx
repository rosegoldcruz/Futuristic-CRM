// TODO: reconnect to Postgres/Supabase when backend is available.
"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { mockWorkOrders } from "@/app/lib/mockData";
import type { WorkOrder } from "@/app/lib/mockData";

const STATUS_COLORS: Record<WorkOrder["status"], string> = {
  scheduled: "bg-cyber-cyan/10 border-cyber-cyan/50 text-cyber-cyan",
  "in-progress": "bg-cyber-green/10 border-cyber-green/50 text-cyber-green",
  completed: "bg-cyber-green/10 border-cyber-green/50 text-cyber-green",
  cancelled: "bg-textMuted/20 border-textMuted/50 text-textMuted",
  pending: "bg-cyber-yellow/10 border-cyber-yellow/50 text-cyber-yellow",
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

export default function WorkOrdersPage() {
  const [search, setSearch] = useState("");
  const workOrders = mockWorkOrders;

  const filtered = useMemo(() => {
    if (!search) return workOrders;
    const s = search.toLowerCase();
    return workOrders.filter((w) =>
      w.id.toLowerCase().includes(s) ||
      w.jobId.toLowerCase().includes(s) ||
      w.installer.toLowerCase().includes(s)
    );
  }, [workOrders, search]);

  const scheduledCount = workOrders.filter((w) => w.status === "scheduled").length;
  const inProgressCount = workOrders.filter((w) => w.status === "in-progress").length;
  const pendingCount = workOrders.filter((w) => w.status === "pending").length;
  const completedCount = workOrders.filter((w) => w.status === "completed").length;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-cyber-cyan" style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}>
            Work Orders
          </h1>
          <p className="text-sm text-textSecondary font-mono">// Installer work order queue and scheduled jobs</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Scheduled" value={scheduledCount} variant="cyan" />
          <KpiCard label="In Progress" value={inProgressCount} variant="green" />
          <KpiCard label="Pending" value={pendingCount} variant="yellow" />
          <KpiCard label="Completed" value={completedCount} variant="green" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search WO ID, job ID, installer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 border border-borderSubtle bg-surface px-3 py-2 text-xs text-textPrimary placeholder-textMuted focus:border-cyber-cyan/60 focus:outline-none font-mono"
          />
          <span className="text-xs text-textMuted font-mono">{filtered.length} / {workOrders.length} orders</span>
        </div>

        <section className="cyber-card-tw border-l-4 border-l-cyber-cyan shadow-cyberInset overflow-x-auto p-0">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-borderSubtle bg-bgDark">
                {["WO ID", "Job ID", "Installer", "Status", "Scheduled Date", "Notes"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-display text-[10px] uppercase tracking-[0.15em] text-cyber-cyan/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((wo) => (
                <tr key={wo.id} className={`border-b border-borderSubtle hover:bg-surface/60 transition-colors ${wo.status === "pending" ? "bg-cyber-yellow/5" : ""}`}>
                  <td className="px-4 py-3 font-mono text-cyber-cyan font-bold">{wo.id}</td>
                  <td className="px-4 py-3 font-mono text-textSecondary">{wo.jobId}</td>
                  <td className="px-4 py-3 font-medium text-textPrimary">{wo.installer}</td>
                  <td className="px-4 py-3"><Badge label={wo.status} colorClass={STATUS_COLORS[wo.status]} /></td>
                  <td className="px-4 py-3 text-textMuted font-mono">{wo.scheduledDate}</td>
                  <td className="px-4 py-3 text-textSecondary max-w-[260px]">{wo.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </DashboardShell>
  );
}
