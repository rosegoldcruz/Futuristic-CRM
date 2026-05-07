// TODO: reconnect to Postgres/Supabase when backend is available.
"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Globe2, Home, Wrench, Factory } from "lucide-react";

function PortalCard({
  icon: Icon,
  title,
  description,
  stats,
  accentColor,
  borderColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  stats: { label: string; value: string }[];
  accentColor: string;
  borderColor: string;
}) {
  return (
    <div className={`cyber-card-tw ${borderColor} shadow-cyberInset space-y-4`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center border ${borderColor} bg-bgDark`}>
          <Icon className={`h-5 w-5 ${accentColor}`} />
        </div>
        <div>
          <h2 className={`font-display text-sm font-bold uppercase tracking-wider ${accentColor}`}>{title}</h2>
          <p className="text-xs text-textMuted font-mono">{description}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="border border-borderSubtle bg-bgDark p-3">
            <p className="font-display text-[10px] uppercase tracking-widest text-textMuted">// {s.label}</p>
            <p className={`mt-1 text-lg font-bold font-display ${accentColor}`}>{s.value}</p>
          </div>
        ))}
      </div>
      <button className={`w-full border ${borderColor} bg-bgDark py-2 text-xs font-display font-bold uppercase tracking-widest ${accentColor} hover:bg-surface/60 transition-colors`}>
        → Access Portal
      </button>
    </div>
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

export default function PortalsPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-cyber-cyan" style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}>
            Portals
          </h1>
          <p className="text-sm text-textSecondary font-mono">// Customer, installer, and supplier portal access center</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Active Sessions" value="12" variant="cyan" />
          <KpiCard label="Homeowner Portals" value="8" variant="green" />
          <KpiCard label="Installer Portals" value="7" variant="yellow" />
          <KpiCard label="Supplier Portals" value="6" variant="magenta" />
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <PortalCard
            icon={Home}
            title="Homeowner Portal"
            description="View project status, documents, and timeline"
            accentColor="text-cyber-cyan"
            borderColor="border-cyber-cyan/30"
            stats={[
              { label: "Active Users", value: "8" },
              { label: "Open Projects", value: "6" },
              { label: "Docs Pending", value: "3" },
              { label: "Satisfaction", value: "4.8★" },
            ]}
          />
          <PortalCard
            icon={Wrench}
            title="Installer Portal"
            description="Work orders, job documents, and scheduling"
            accentColor="text-cyber-yellow"
            borderColor="border-cyber-yellow/30"
            stats={[
              { label: "Active Installers", value: "7" },
              { label: "Work Orders", value: "6" },
              { label: "Completed Today", value: "1" },
              { label: "Avg SLA", value: "97.4%" },
            ]}
          />
          <PortalCard
            icon={Factory}
            title="Supplier Portal"
            description="Order status, inventory, and delivery management"
            accentColor="text-cyber-magenta"
            borderColor="border-cyber-magenta/30"
            stats={[
              { label: "Active Suppliers", value: "6" },
              { label: "Open Orders", value: "18" },
              { label: "Delayed Items", value: "2" },
              { label: "OTIF Rate", value: "96.4%" },
            ]}
          />
        </div>
      </div>
    </DashboardShell>
  );
}
