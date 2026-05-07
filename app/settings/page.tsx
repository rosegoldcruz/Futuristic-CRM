"use client";

import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CreditCard, Bell, Settings, Shield } from "lucide-react";

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

const SETTINGS_SECTIONS = [
  {
    icon: CreditCard,
    title: "Billing & Plan",
    description: "Manage your subscription, invoices, and payment methods",
    href: "/settings/billing",
    accent: "text-cyber-cyan",
    border: "border-cyber-cyan/30",
  },
  {
    icon: Bell,
    title: "Notifications",
    description: "Configure alerts, email preferences, and SMS settings",
    href: "/settings/notifications",
    accent: "text-cyber-yellow",
    border: "border-cyber-yellow/30",
  },
  {
    icon: Settings,
    title: "System Config",
    description: "Branding, integrations, feature flags, and system settings",
    href: "/settings/system",
    accent: "text-cyber-magenta",
    border: "border-cyber-magenta/30",
  },
  {
    icon: Shield,
    title: "Security & Audit",
    description: "API keys, two-factor auth, and system access controls",
    href: "/audit-logs",
    accent: "text-cyber-green",
    border: "border-cyber-green/30",
  },
];

export default function SettingsPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-cyber-cyan" style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}>
            Settings
          </h1>
          <p className="text-sm text-textSecondary font-mono">// System configuration, billing, and preferences</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Plan" value="Pro" variant="cyan" />
          <KpiCard label="Users" value="8" variant="green" />
          <KpiCard label="Integrations" value="3" variant="yellow" />
          <KpiCard label="API Keys" value="2 active" variant="magenta" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {SETTINGS_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <Link key={section.href} href={section.href}>
                <div className={`cyber-card-tw ${section.border} shadow-cyberInset hover:bg-surface/80 transition-colors cursor-pointer`}>
                  <div className="flex items-start gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center border ${section.border} bg-bgDark shrink-0`}>
                      <Icon className={`h-5 w-5 ${section.accent}`} />
                    </div>
                    <div>
                      <h2 className={`font-display text-sm font-bold uppercase tracking-wider ${section.accent}`}>{section.title}</h2>
                      <p className="mt-1 text-xs text-textMuted font-mono">{section.description}</p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
