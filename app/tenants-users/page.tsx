// TODO: reconnect to Postgres/Supabase when backend is available.
"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";

const USERS = [
  { id: "USR-001", name: "Admin User", email: "admin@vulpine.io", role: "super-admin", tenant: "Vulpine HQ", status: "active", lastLogin: "2025-05-07" },
  { id: "USR-002", name: "Riley Martinez", email: "riley.m@vulpine.io", role: "sales-rep", tenant: "Vulpine HQ", status: "active", lastLogin: "2025-05-07" },
  { id: "USR-003", name: "Jordan Thompson", email: "jordan.t@vulpine.io", role: "sales-rep", tenant: "Vulpine HQ", status: "active", lastLogin: "2025-05-06" },
  { id: "USR-004", name: "Alex Brennan", email: "alex.b@vulpine.io", role: "ops-manager", tenant: "Vulpine HQ", status: "active", lastLogin: "2025-05-06" },
  { id: "USR-005", name: "Botta Install Co.", email: "botta@installer.io", role: "installer", tenant: "Botta Install", status: "active", lastLogin: "2025-05-05" },
  { id: "USR-006", name: "SW Installs", email: "ops@swinstalls.io", role: "installer", tenant: "SW Installs", status: "active", lastLogin: "2025-05-04" },
  { id: "USR-007", name: "AZ Cabinet Supply", email: "orders@azcab.io", role: "supplier", tenant: "AZ Cabinet Supply", status: "active", lastLogin: "2025-05-03" },
  { id: "USR-008", name: "Former Rep", email: "old.rep@vulpine.io", role: "sales-rep", tenant: "Vulpine HQ", status: "inactive", lastLogin: "2025-03-15" },
];

const ROLE_COLORS: Record<string, string> = {
  "super-admin": "bg-cyber-magenta/10 border-cyber-magenta/50 text-cyber-magenta",
  "sales-rep": "bg-cyber-cyan/10 border-cyber-cyan/50 text-cyber-cyan",
  "ops-manager": "bg-cyber-yellow/10 border-cyber-yellow/50 text-cyber-yellow",
  installer: "bg-cyber-green/10 border-cyber-green/50 text-cyber-green",
  supplier: "bg-textMuted/20 border-textMuted/50 text-textMuted",
};

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

export default function TenantsUsersPage() {
  const activeCount = USERS.filter((u) => u.status === "active").length;
  const internalCount = USERS.filter((u) => u.tenant === "Vulpine HQ").length;
  const partnerCount = USERS.filter((u) => u.role === "installer" || u.role === "supplier").length;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-cyber-cyan" style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}>
            Tenants & Users
          </h1>
          <p className="text-sm text-textSecondary font-mono">// User accounts, roles, tenant access, and permissions</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total Users" value={USERS.length} variant="cyan" />
          <KpiCard label="Active" value={activeCount} variant="green" />
          <KpiCard label="Internal Team" value={internalCount} variant="yellow" />
          <KpiCard label="Partner Portals" value={partnerCount} variant="magenta" />
        </div>

        <section className="cyber-card-tw border-l-4 border-l-cyber-cyan shadow-cyberInset overflow-x-auto p-0">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-borderSubtle bg-bgDark">
                {["ID", "Name", "Email", "Role", "Tenant", "Status", "Last Login"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-display text-[10px] uppercase tracking-[0.15em] text-cyber-cyan/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {USERS.map((u) => (
                <tr key={u.id} className={`border-b border-borderSubtle hover:bg-surface/60 transition-colors ${u.status === "inactive" ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-mono text-textMuted">{u.id}</td>
                  <td className="px-4 py-3 font-medium text-textPrimary">{u.name}</td>
                  <td className="px-4 py-3 text-textMuted font-mono">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${ROLE_COLORS[u.role] || "bg-textMuted/20 border-textMuted/50 text-textMuted"}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-textSecondary">{u.tenant}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase ${u.status === "active" ? "text-cyber-green" : "text-textMuted"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${u.status === "active" ? "bg-cyber-green animate-pulse" : "bg-textMuted"}`} />
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-textMuted font-mono">{u.lastLogin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </DashboardShell>
  );
}
