// TODO: reconnect to automation engine when backend is available.
"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Cpu, Zap, Clock, CheckCircle } from "lucide-react";

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

const AUTOMATIONS = [
  { id: "AUT-001", name: "New Lead → Assign Rep", trigger: "Lead Created", action: "Notify sales rep + create task", status: "active", runs: 142, lastRun: "2025-05-07" },
  { id: "AUT-002", name: "Quote Sent → Follow-Up Reminder", trigger: "Quote Sent", action: "Schedule follow-up call in 3 days", status: "active", runs: 87, lastRun: "2025-05-06" },
  { id: "AUT-003", name: "Job Scheduled → Send Installer WO", trigger: "Job Scheduled", action: "Create + send work order to installer", status: "active", runs: 54, lastRun: "2025-05-07" },
  { id: "AUT-004", name: "Install Complete → Request QC Photos", trigger: "Stage = Completed", action: "Send QC photo request to installer", status: "active", runs: 38, lastRun: "2025-05-05" },
  { id: "AUT-005", name: "Payment Overdue → Alert", trigger: "Due Date Passed", action: "Flag job + notify ops team", status: "active", runs: 12, lastRun: "2025-05-01" },
  { id: "AUT-006", name: "Material Delay → Reschedule", trigger: "Material ETA Slipped", action: "Flag job + alert scheduler", status: "paused", runs: 8, lastRun: "2025-04-28" },
];

export default function AutomationPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-cyber-cyan" style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}>
            Automation
          </h1>
          <p className="text-sm text-textSecondary font-mono">// Workflow automation rules, triggers, and pipeline actions</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Active Rules" value={AUTOMATIONS.filter((a) => a.status === "active").length} variant="cyan" />
          <KpiCard label="Total Runs (30d)" value={AUTOMATIONS.reduce((s, a) => s + a.runs, 0)} variant="green" />
          <KpiCard label="Paused" value={AUTOMATIONS.filter((a) => a.status === "paused").length} variant="yellow" />
          <KpiCard label="Automation Rate" value="94%" variant="magenta" />
        </div>

        <section className="cyber-card-tw border-l-4 border-l-cyber-cyan shadow-cyberInset overflow-x-auto p-0">
          <div className="px-4 py-3 border-b border-borderSubtle bg-bgDark">
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-cyber-cyan" style={{ textShadow: "0 0 8px rgba(0,240,255,0.4)" }}>
              // Automation Rules
            </h2>
          </div>
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-borderSubtle bg-bgDark">
                {["ID", "Rule Name", "Trigger", "Action", "Status", "Runs", "Last Run"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-display text-[10px] uppercase tracking-[0.15em] text-cyber-cyan/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AUTOMATIONS.map((a) => (
                <tr key={a.id} className="border-b border-borderSubtle hover:bg-surface/60 transition-colors">
                  <td className="px-4 py-3 font-mono text-textMuted">{a.id}</td>
                  <td className="px-4 py-3 font-medium text-textPrimary">{a.name}</td>
                  <td className="px-4 py-3 text-textSecondary">{a.trigger}</td>
                  <td className="px-4 py-3 text-textSecondary">{a.action}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${a.status === "active" ? "bg-cyber-green/10 border-cyber-green/50 text-cyber-green" : "bg-cyber-yellow/10 border-cyber-yellow/50 text-cyber-yellow"}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-cyber-cyan font-bold">{a.runs}</td>
                  <td className="px-4 py-3 text-textMuted font-mono">{a.lastRun}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </DashboardShell>
  );
}
