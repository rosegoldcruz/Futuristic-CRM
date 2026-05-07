// TODO: reconnect to Postgres/Supabase when backend is available.
"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TrendingUp, Users, MousePointerClick, Target } from "lucide-react";

function KpiCard({ label, value, delta, variant = "cyan" }: { label: string; value: string; delta?: string; variant?: "cyan" | "green" | "yellow" | "magenta" }) {
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
      {delta && <p className="mt-1 text-xs text-cyber-green font-mono">{delta}</p>}
    </div>
  );
}

function Panel({ title, children, variant = "cyan" }: { title: string; children: React.ReactNode; variant?: "cyan" | "green" | "yellow" | "magenta" }) {
  const colors = { cyan: "border-l-cyber-cyan", green: "border-l-cyber-green", yellow: "border-l-cyber-yellow", magenta: "border-l-cyber-magenta" };
  return (
    <section className={`cyber-card-tw border-l-4 ${colors[variant]} shadow-cyberInset`}>
      <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-[0.15em] text-cyber-cyan" style={{ textShadow: "0 0 8px rgba(0,240,255,0.4)" }}>
        // {title}
      </h2>
      {children}
    </section>
  );
}

const TOP_SOURCES = [
  { source: "Meta Ads", leads: 18, conversion: "24%" },
  { source: "Google", leads: 9, conversion: "31%" },
  { source: "TikTok", leads: 6, conversion: "18%" },
  { source: "Referral", leads: 5, conversion: "60%" },
  { source: "Instagram", leads: 4, conversion: "20%" },
];

const CAMPAIGNS = [
  { name: "Kitchen Reface — AZ Spring", status: "active", spend: "$1,200", leads: 14, cpl: "$86" },
  { name: "Cabinet Replacement — Mesa", status: "active", spend: "$800", leads: 8, cpl: "$100" },
  { name: "Closet Build — Scottsdale", status: "active", spend: "$600", leads: 6, cpl: "$100" },
  { name: "Full Remodel — Phoenix Q1", status: "paused", spend: "$2,400", leads: 22, cpl: "$109" },
];

export default function MarketingPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-cyber-cyan" style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}>
            Marketing
          </h1>
          <p className="text-sm text-textSecondary font-mono">// Campaign performance, lead sources, and channel analytics</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total Leads (30d)" value="42" delta="+12 vs last month" variant="cyan" />
          <KpiCard label="Qualified Rate" value="64%" delta="+4% vs last month" variant="green" />
          <KpiCard label="Avg CPL" value="$97" delta="−$8 vs last month" variant="yellow" />
          <KpiCard label="Conversion Rate" value="28%" delta="+3% vs last month" variant="magenta" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Top Lead Sources" variant="cyan">
            <div className="space-y-2">
              {TOP_SOURCES.map((s) => (
                <div key={s.source} className="flex items-center justify-between border-b border-borderSubtle py-2 last:border-0">
                  <span className="text-xs text-textSecondary">{s.source}</span>
                  <div className="flex gap-6 text-xs font-mono">
                    <span className="text-cyber-cyan font-bold">{s.leads} leads</span>
                    <span className="text-cyber-green">{s.conversion} conv.</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Active Campaigns" variant="yellow">
            <div className="space-y-3">
              {CAMPAIGNS.map((c) => (
                <div key={c.name} className="border-b border-borderSubtle pb-3 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-textPrimary">{c.name}</span>
                    <span className={`text-[10px] font-bold uppercase border px-1.5 py-0.5 ${c.status === "active" ? "text-cyber-green border-cyber-green/50 bg-cyber-green/10" : "text-textMuted border-textMuted/50 bg-textMuted/10"}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex gap-4 text-[10px] font-mono text-textMuted">
                    <span>Spend: <span className="text-cyber-yellow">{c.spend}</span></span>
                    <span>Leads: <span className="text-cyber-cyan">{c.leads}</span></span>
                    <span>CPL: <span className="text-cyber-magenta">{c.cpl}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </DashboardShell>
  );
}
