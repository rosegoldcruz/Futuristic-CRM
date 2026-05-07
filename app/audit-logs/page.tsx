// TODO: reconnect to Postgres/Supabase when backend is available.
"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ShieldCheck } from "lucide-react";

const AUDIT_LOGS = [
  { id: "AUD-001", user: "riley.m@vulpine.io", action: "Created Lead", entity: "Lead L-1008 — David Torres", ip: "10.0.1.42", timestamp: "2025-05-06 14:32:11" },
  { id: "AUD-002", user: "jordan.t@vulpine.io", action: "Updated Quote", entity: "Quote Q-2202 — status → pending", ip: "10.0.1.55", timestamp: "2025-05-06 13:18:04" },
  { id: "AUD-003", user: "admin@vulpine.io", action: "Assigned Installer", entity: "Job VK-2038 → Precision Kitchen Co.", ip: "10.0.1.10", timestamp: "2025-05-06 11:05:33" },
  { id: "AUD-004", user: "riley.m@vulpine.io", action: "Sent Quote", entity: "Quote Q-2206 — Tony Nguyen", ip: "10.0.1.42", timestamp: "2025-05-06 10:44:19" },
  { id: "AUD-005", user: "alex.b@vulpine.io", action: "Uploaded Document", entity: "File F-004 — tony-nguyen-quote-v2.pdf", ip: "10.0.1.61", timestamp: "2025-05-05 16:12:50" },
  { id: "AUD-006", user: "admin@vulpine.io", action: "Flagged Payment Hold", entity: "Invoice INV-5503 — Marcus Wilson", ip: "10.0.1.10", timestamp: "2025-05-05 09:33:07" },
  { id: "AUD-007", user: "jordan.t@vulpine.io", action: "Created Job", entity: "Job VK-2050 — Diane Alvarez", ip: "10.0.1.55", timestamp: "2025-05-04 15:22:41" },
  { id: "AUD-008", user: "riley.m@vulpine.io", action: "Updated Lead Status", entity: "Lead L-1002 — Marcus Wilson → quote-ready", ip: "10.0.1.42", timestamp: "2025-05-04 11:08:29" },
];

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

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return AUDIT_LOGS;
    const s = search.toLowerCase();
    return AUDIT_LOGS.filter((l) =>
      l.user.toLowerCase().includes(s) ||
      l.action.toLowerCase().includes(s) ||
      l.entity.toLowerCase().includes(s)
    );
  }, [search]);

  const uniqueUsers = new Set(AUDIT_LOGS.map((l) => l.user)).size;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-cyber-cyan" style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}>
            Audit Log
          </h1>
          <p className="text-sm text-textSecondary font-mono">// System activity log, user actions, and change history</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total Events (7d)" value={AUDIT_LOGS.length} variant="cyan" />
          <KpiCard label="Active Users" value={uniqueUsers} variant="green" />
          <KpiCard label="Admin Actions" value={AUDIT_LOGS.filter((l) => l.user.startsWith("admin")).length} variant="yellow" />
          <KpiCard label="Last Event" value="14 min ago" variant="magenta" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search user, action, entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 border border-borderSubtle bg-surface px-3 py-2 text-xs text-textPrimary placeholder-textMuted focus:border-cyber-cyan/60 focus:outline-none font-mono"
          />
          <span className="text-xs text-textMuted font-mono">{filtered.length} / {AUDIT_LOGS.length} events</span>
        </div>

        <section className="cyber-card-tw border-l-4 border-l-cyber-cyan shadow-cyberInset overflow-x-auto p-0">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-borderSubtle bg-bgDark">
                {["ID", "User", "Action", "Entity / Details", "IP", "Timestamp"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-display text-[10px] uppercase tracking-[0.15em] text-cyber-cyan/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr key={log.id} className="border-b border-borderSubtle hover:bg-surface/60 transition-colors">
                  <td className="px-4 py-3 font-mono text-textMuted">{log.id}</td>
                  <td className="px-4 py-3 text-cyber-cyan font-mono">{log.user}</td>
                  <td className="px-4 py-3 font-medium text-textPrimary">{log.action}</td>
                  <td className="px-4 py-3 text-textSecondary">{log.entity}</td>
                  <td className="px-4 py-3 text-textMuted font-mono">{log.ip}</td>
                  <td className="px-4 py-3 text-textMuted font-mono whitespace-nowrap">{log.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </DashboardShell>
  );
}
