import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function HomePage() {
  return (
    <DashboardShell>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-cyber-cyan" style={{ textShadow: '0 0 20px rgba(0, 240, 255, 0.5)' }}>
              Vulpine Marketplace OS
            </h1>
            <p className="text-sm text-textSecondary font-mono">
              // Live view of your pipeline, partners, and materials network
            </p>
          </div>

          {/* KPI Grid */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Open leads" value="37" delta="+12 this week" variant="cyan" />
            <KpiCard label="Active jobs" value="9" delta="3 install today" variant="magenta" />
            <KpiCard label="Installer partners" value="26" delta="2 new" variant="yellow" />
            <KpiCard label="Monthly GMV" value="$184K" delta="+18%" variant="green" />
          </div>

          {/* Panels Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Pipeline today" variant="cyan">
              <ul className="space-y-3 text-sm">
                <li className="flex items-center justify-between border-b border-borderSubtle pb-2">
                  <span className="text-textSecondary">Inbound leads</span>
                  <span className="font-display font-bold text-cyber-green" style={{ textShadow: '0 0 6px rgba(0, 255, 102, 0.5)' }}>14</span>
                </li>
                <li className="flex items-center justify-between border-b border-borderSubtle pb-2">
                  <span className="text-textSecondary">Quotes sent</span>
                  <span className="font-display font-bold text-cyber-yellow" style={{ textShadow: '0 0 6px rgba(255, 230, 0, 0.5)' }}>7</span>
                </li>
                <li className="flex items-center justify-between border-b border-borderSubtle pb-2">
                  <span className="text-textSecondary">Jobs scheduled</span>
                  <span className="font-display font-bold text-cyber-cyan" style={{ textShadow: '0 0 6px rgba(0, 240, 255, 0.5)' }}>4</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-textSecondary">Installs completed</span>
                  <span className="font-display font-bold text-cyber-magenta" style={{ textShadow: '0 0 6px rgba(255, 0, 255, 0.5)' }}>2</span>
                </li>
              </ul>
            </Panel>

            <Panel title="Network health" variant="green">
              <ul className="space-y-3 text-sm">
                <li className="flex items-center justify-between border-b border-borderSubtle pb-2">
                  <span className="text-textSecondary">Avg lead → install</span>
                  <span className="font-display font-bold text-textPrimary">9.3 days</span>
                </li>
                <li className="flex items-center justify-between border-b border-borderSubtle pb-2">
                  <span className="text-textSecondary">Installer SLA</span>
                  <span className="font-display font-bold text-cyber-green" style={{ textShadow: '0 0 6px rgba(0, 255, 102, 0.5)' }}>98.2%</span>
                </li>
                <li className="flex items-center justify-between border-b border-borderSubtle pb-2">
                  <span className="text-textSecondary">Material OTIF</span>
                  <span className="font-display font-bold text-cyber-green" style={{ textShadow: '0 0 6px rgba(0, 255, 102, 0.5)' }}>96.4%</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-textSecondary">Callbacks / issues</span>
                  <span className="font-display font-bold text-cyber-yellow" style={{ textShadow: '0 0 6px rgba(255, 230, 0, 0.5)' }}>3 open</span>
                </li>
              </ul>
            </Panel>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <Panel title="Critical jobs watchlist" variant="red">
            <ul className="space-y-4 text-sm">
              <li className="border-b border-borderSubtle pb-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-textPrimary">
                    Emma – Scottsdale reface
                  </span>
                  <StatusBadge status="warning">Missing panels</StatusBadge>
                </div>
                <p className="mt-1 text-xs text-textMuted font-mono">
                  Job #VK-2041 · install in 2 days · Botta Install Co.
                </p>
              </li>
              <li className="border-b border-borderSubtle pb-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-textPrimary">
                    Wilson – Mesa townhouse
                  </span>
                  <StatusBadge status="danger">Payment hold</StatusBadge>
                </div>
                <p className="mt-1 text-xs text-textMuted font-mono">
                  Job #VK-2033 · QC photos pending.
                </p>
              </li>
              <li>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-textPrimary">
                    Alvarez – Phoenix flip
                  </span>
                  <StatusBadge status="info">Awaiting installer</StatusBadge>
                </div>
                <p className="mt-1 text-xs text-textMuted font-mono">
                  Job #VK-2050 · 4 bids · assign by tonight.
                </p>
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </DashboardShell>
  );
}

type KpiProps = {
  label: string;
  value: string;
  delta: string;
  variant?: "cyan" | "magenta" | "yellow" | "green";
};

function KpiCard({ label, value, delta, variant = "cyan" }: KpiProps) {
  const colors = {
    cyan: { border: "border-cyber-cyan/30", text: "text-cyber-cyan", glow: "rgba(0, 240, 255, 0.5)" },
    magenta: { border: "border-cyber-magenta/30", text: "text-cyber-magenta", glow: "rgba(255, 0, 255, 0.5)" },
    yellow: { border: "border-cyber-yellow/30", text: "text-cyber-yellow", glow: "rgba(255, 230, 0, 0.5)" },
    green: { border: "border-cyber-green/30", text: "text-cyber-green", glow: "rgba(0, 255, 102, 0.5)" },
  };
  const c = colors[variant];

  return (
    <div className={`cyber-card-tw ${c.border} shadow-cyberInset hover:shadow-cyberSm transition-all duration-300`}>
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-textMuted">
        // {label}
      </p>
      <p className={`mt-2 text-2xl font-bold font-display ${c.text}`} style={{ textShadow: `0 0 15px ${c.glow}` }}>
        {value}
      </p>
      <p className="mt-1 flex items-center gap-1 text-xs text-cyber-green">
        <span className="h-1.5 w-1.5 rounded-full bg-cyber-green shadow-[0_0_4px_rgba(0,255,102,0.8)]" />
        {delta}
      </p>
    </div>
  );
}

type PanelProps = {
  title: string;
  children: React.ReactNode;
  variant?: "cyan" | "magenta" | "yellow" | "green" | "red";
};

function Panel({ title, children, variant = "cyan" }: PanelProps) {
  const colors = {
    cyan: "border-l-cyber-cyan",
    magenta: "border-l-cyber-magenta",
    yellow: "border-l-cyber-yellow",
    green: "border-l-cyber-green",
    red: "border-l-cyber-red",
  };

  return (
    <section className={`cyber-card-tw border-l-4 ${colors[variant]} shadow-cyberInset`}>
      <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-[0.15em] text-cyber-cyan" style={{ textShadow: '0 0 8px rgba(0, 240, 255, 0.4)' }}>
        // {title}
      </h2>
      {children}
    </section>
  );
}

type StatusBadgeProps = {
  status: "warning" | "danger" | "info" | "success";
  children: React.ReactNode;
};

function StatusBadge({ status, children }: StatusBadgeProps) {
  const styles = {
    warning: "bg-cyber-yellow/10 border-cyber-yellow/50 text-cyber-yellow",
    danger: "bg-cyber-red/10 border-cyber-red/50 text-cyber-red",
    info: "bg-cyber-cyan/10 border-cyber-cyan/50 text-cyber-cyan",
    success: "bg-cyber-green/10 border-cyber-green/50 text-cyber-green",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" style={{ boxShadow: '0 0 4px currentColor' }} />
      {children}
    </span>
  );
}
