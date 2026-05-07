// TODO: reconnect to Postgres/Supabase when backend is available.
"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Activity, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

function KpiCard({ label, value, delta, variant = "cyan" }: { label: string; value: string; delta?: string; variant?: "cyan" | "green" | "yellow" | "red" | "magenta" }) {
  const colors = {
    cyan: { border: "border-cyber-cyan/30", text: "text-cyber-cyan", glow: "rgba(0,240,255,0.5)" },
    green: { border: "border-cyber-green/30", text: "text-cyber-green", glow: "rgba(0,255,102,0.5)" },
    yellow: { border: "border-cyber-yellow/30", text: "text-cyber-yellow", glow: "rgba(255,230,0,0.5)" },
    red: { border: "border-cyber-red/30", text: "text-cyber-red", glow: "rgba(255,0,68,0.5)" },
    magenta: { border: "border-cyber-magenta/30", text: "text-cyber-magenta", glow: "rgba(255,0,255,0.5)" },
  };
  const c = colors[variant];
  return (
    <div className={`cyber-card-tw ${c.border} shadow-cyberInset`}>
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-textMuted">// {label}</p>
      <p className={`mt-2 text-2xl font-bold font-display ${c.text}`} style={{ textShadow: `0 0 15px ${c.glow}` }}>{value}</p>
      {delta && <p className="mt-1 text-xs text-textMuted font-mono">{delta}</p>}
    </div>
  );
}

function Panel({ title, children, variant = "cyan" }: { title: string; children: React.ReactNode; variant?: "cyan" | "green" | "yellow" | "red" | "magenta" }) {
  const colors = {
    cyan: "border-l-cyber-cyan",
    green: "border-l-cyber-green",
    yellow: "border-l-cyber-yellow",
    red: "border-l-cyber-red",
    magenta: "border-l-cyber-magenta",
  };
  return (
    <section className={`cyber-card-tw border-l-4 ${colors[variant]} shadow-cyberInset`}>
      <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-[0.15em] text-cyber-cyan" style={{ textShadow: "0 0 8px rgba(0,240,255,0.4)" }}>
        // {title}
      </h2>
      {children}
    </section>
  );
}

const ALERTS = [
  { severity: "warn", message: "Rachel Kim — Vanity delivery delayed to 5/15", job: "VK-2029" },
  { severity: "danger", message: "Marcus Wilson — Payment hold unresolved 3 days", job: "VK-2033" },
  { severity: "info", message: "Diane Alvarez — No installer assigned", job: "VK-2050" },
];

const SLA_METRICS = [
  { label: "Lead Response Time", value: "1.4 hrs", status: "green" },
  { label: "Lead → Quote", value: "2.1 days", status: "green" },
  { label: "Quote → Job", value: "3.8 days", status: "green" },
  { label: "Job → Install", value: "9.3 days", status: "yellow" },
  { label: "Installer SLA", value: "98.2%", status: "green" },
  { label: "Material OTIF", value: "96.4%", status: "green" },
  { label: "QC Pass Rate", value: "94.1%", status: "yellow" },
  { label: "Customer CSAT", value: "4.8 / 5", status: "green" },
];

export default function MetricsPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-cyber-cyan" style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}>
            Intelligence
          </h1>
          <p className="text-sm text-textSecondary font-mono">// Network health, operational alerts, bottlenecks, and SLA metrics</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Avg Lead → Install" value="9.3 days" delta="Target: 10 days" variant="green" />
          <KpiCard label="Installer SLA" value="98.2%" delta="+0.4% vs last month" variant="green" />
          <KpiCard label="Material OTIF" value="96.4%" delta="−1.2% vs last month" variant="yellow" />
          <KpiCard label="Open Issues" value="3" delta="2 payment · 1 material" variant="red" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="SLA Metrics" variant="cyan">
            <div className="space-y-2">
              {SLA_METRICS.map((m) => (
                <div key={m.label} className="flex items-center justify-between border-b border-borderSubtle py-2 last:border-0">
                  <span className="text-xs text-textSecondary font-mono">{m.label}</span>
                  <span className={`text-xs font-bold font-mono ${m.status === "green" ? "text-cyber-green" : m.status === "yellow" ? "text-cyber-yellow" : "text-cyber-red"}`}>
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Active Alerts" variant="red">
            <div className="space-y-3">
              {ALERTS.map((a, i) => (
                <div key={i} className={`border-l-2 pl-3 py-1 ${a.severity === "danger" ? "border-l-cyber-red" : a.severity === "warn" ? "border-l-cyber-yellow" : "border-l-cyber-cyan"}`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${a.severity === "danger" ? "text-cyber-red" : a.severity === "warn" ? "text-cyber-yellow" : "text-cyber-cyan"}`} />
                    <div>
                      <p className="text-xs text-textPrimary">{a.message}</p>
                      <p className="text-[10px] text-textMuted font-mono mt-0.5">Job {a.job}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Panel title="Pipeline Today" variant="cyan">
            <ul className="space-y-2 text-xs">
              {[
                { label: "Inbound leads", value: "14", color: "text-cyber-cyan" },
                { label: "Quotes sent", value: "7", color: "text-cyber-yellow" },
                { label: "Jobs scheduled", value: "4", color: "text-cyber-green" },
                { label: "Installs completed", value: "2", color: "text-cyber-magenta" },
              ].map((item) => (
                <li key={item.label} className="flex justify-between border-b border-borderSubtle pb-2 last:border-0">
                  <span className="text-textSecondary">{item.label}</span>
                  <span className={`font-display font-bold ${item.color}`}>{item.value}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Installer Performance" variant="green">
            <ul className="space-y-2 text-xs">
              {[
                { name: "Botta Install Co.", sla: "97%", jobs: 3 },
                { name: "Precision Kitchen", sla: "99%", jobs: 2 },
                { name: "SW Installs", sla: "94%", jobs: 1 },
                { name: "Desert Finish", sla: "91%", jobs: 1 },
              ].map((ins) => (
                <li key={ins.name} className="flex justify-between items-center border-b border-borderSubtle pb-2 last:border-0">
                  <span className="text-textSecondary">{ins.name}</span>
                  <div className="flex gap-3 text-right">
                    <span className="text-cyber-green font-mono font-bold">{ins.sla}</span>
                    <span className="text-textMuted font-mono">{ins.jobs} jobs</span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Supplier Health" variant="yellow">
            <ul className="space-y-2 text-xs">
              {[
                { name: "AZ Cabinet Supply", rate: "96%", orders: 4 },
                { name: "ProPanel AZ", rate: "98%", orders: 2 },
                { name: "Phoenix Hardware", rate: "99%", orders: 6 },
                { name: "Vanity Pro Supply", rate: "87%", orders: 2, warn: true },
              ].map((sup) => (
                <li key={sup.name} className="flex justify-between items-center border-b border-borderSubtle pb-2 last:border-0">
                  <span className="text-textSecondary">{sup.name}</span>
                  <div className="flex gap-3 text-right">
                    <span className={`font-mono font-bold ${sup.warn ? "text-cyber-red" : "text-cyber-green"}`}>{sup.rate}</span>
                    <span className="text-textMuted font-mono">{sup.orders} open</span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </DashboardShell>
  );
}
