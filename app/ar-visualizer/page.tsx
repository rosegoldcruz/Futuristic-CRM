// TODO: AR Visualizer — connect to rendering engine when available.
"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Sparkles, Box, Eye, Layers } from "lucide-react";

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

const SESSIONS = [
  { id: "AR-001", customer: "Emma Castillo", project: "Kitchen Reface", style: "Shaker White", status: "Saved", date: "2025-05-03" },
  { id: "AR-002", customer: "James Park", project: "Full Remodel", style: "Modern Gray", status: "Shared", date: "2025-05-04" },
  { id: "AR-003", customer: "Tony Nguyen", project: "Kitchen Reface", style: "Espresso", status: "Pending", date: "2025-05-06" },
  { id: "AR-004", customer: "Rachel Kim", project: "Bathroom Vanity", style: "White Oak", status: "Saved", date: "2025-05-06" },
];

export default function ARVisualizerPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-cyber-cyan" style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}>
            AR Visualizer
          </h1>
          <p className="text-sm text-textSecondary font-mono">// Remodel visualization and cabinet / closet preview tools</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total Sessions" value="24" variant="cyan" />
          <KpiCard label="Saved Designs" value="18" variant="green" />
          <KpiCard label="Shared with Customer" value="9" variant="magenta" />
          <KpiCard label="Converted to Quote" value="6" variant="yellow" />
        </div>

        {/* AR Preview Placeholder */}
        <div className="cyber-card-tw border-l-4 border-l-cyber-magenta shadow-cyberInset">
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-[0.15em] text-cyber-magenta" style={{ textShadow: "0 0 8px rgba(255,0,255,0.4)" }}>
            // 3D Preview Engine
          </h2>
          <div className="flex h-48 items-center justify-center border border-borderSubtle bg-bgDark">
            <div className="text-center space-y-3">
              <Sparkles className="h-10 w-10 text-cyber-magenta mx-auto" style={{ filter: "drop-shadow(0 0 8px rgba(255,0,255,0.6))" }} />
              <p className="font-display text-sm uppercase tracking-widest text-cyber-magenta">AR Engine Loading</p>
              <p className="text-xs text-textMuted font-mono">// 3D render module — connect WebGL engine to enable</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="cyber-card-tw border-cyber-cyan/20 shadow-cyberInset text-center space-y-3">
            <Box className="h-8 w-8 text-cyber-cyan mx-auto" />
            <p className="font-display text-xs uppercase tracking-widest text-cyber-cyan">Cabinet Configurator</p>
            <p className="text-xs text-textMuted font-mono">// Build custom cabinet layouts in 3D</p>
            <div className="border border-borderSubtle py-1 text-[10px] text-textMuted font-mono">COMING SOON</div>
          </div>
          <div className="cyber-card-tw border-cyber-yellow/20 shadow-cyberInset text-center space-y-3">
            <Layers className="h-8 w-8 text-cyber-yellow mx-auto" />
            <p className="font-display text-xs uppercase tracking-widest text-cyber-yellow">Finish Selector</p>
            <p className="text-xs text-textMuted font-mono">// Preview door styles, finishes, and hardware</p>
            <div className="border border-borderSubtle py-1 text-[10px] text-textMuted font-mono">COMING SOON</div>
          </div>
          <div className="cyber-card-tw border-cyber-magenta/20 shadow-cyberInset text-center space-y-3">
            <Eye className="h-8 w-8 text-cyber-magenta mx-auto" />
            <p className="font-display text-xs uppercase tracking-widest text-cyber-magenta">Customer Preview Link</p>
            <p className="text-xs text-textMuted font-mono">// Share AR view with homeowner for approval</p>
            <div className="border border-borderSubtle py-1 text-[10px] text-textMuted font-mono">COMING SOON</div>
          </div>
        </div>

        {/* Sessions Table */}
        <section className="cyber-card-tw border-l-4 border-l-cyber-cyan shadow-cyberInset overflow-x-auto p-0">
          <div className="px-4 py-3 border-b border-borderSubtle bg-bgDark">
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-cyber-cyan" style={{ textShadow: "0 0 8px rgba(0,240,255,0.4)" }}>
              // Visualization Sessions
            </h2>
          </div>
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-borderSubtle bg-bgDark">
                {["ID", "Customer", "Project", "Selected Style", "Status", "Date"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-display text-[10px] uppercase tracking-[0.15em] text-cyber-cyan/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SESSIONS.map((s) => (
                <tr key={s.id} className="border-b border-borderSubtle hover:bg-surface/60 transition-colors">
                  <td className="px-4 py-3 font-mono text-textMuted">{s.id}</td>
                  <td className="px-4 py-3 font-medium text-textPrimary">{s.customer}</td>
                  <td className="px-4 py-3 text-textSecondary">{s.project}</td>
                  <td className="px-4 py-3 text-textSecondary">{s.style}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.status === "Shared" ? "bg-cyber-cyan/10 border-cyber-cyan/50 text-cyber-cyan" : s.status === "Saved" ? "bg-cyber-green/10 border-cyber-green/50 text-cyber-green" : "bg-cyber-yellow/10 border-cyber-yellow/50 text-cyber-yellow"}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-textMuted font-mono">{s.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </DashboardShell>
  );
}
