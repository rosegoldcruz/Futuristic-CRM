import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { UserRole } from "@prisma/client";
import { requireActiveUser } from "@/lib/auth/access";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  PlugZap,
} from "lucide-react";
import type { ComponentType } from "react";

type ModulePageProps = {
  title: string;
  eyebrow?: string;
  description: string;
  status?: "functional" | "coming-soon";
  items?: string[];
  requiredRoles?: UserRole[];
};

export async function ModulePage({
  title,
  eyebrow = "CRM Shell",
  description,
  status = "functional",
  items = [],
  requiredRoles,
}: ModulePageProps) {
  const user = await requireActiveUser(requiredRoles);
  const isComingSoon = status === "coming-soon";

  return (
    <DashboardShell user={user}>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="space-y-3">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-cyber-cyan">
            // {eyebrow}
          </p>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl space-y-2">
              <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-textPrimary">
                {title}
              </h1>
              <p className="text-sm leading-6 text-textSecondary">{description}</p>
            </div>
            <StatusBadge comingSoon={isComingSoon} />
          </div>
        </section>

        {isComingSoon ? (
          <section className="cyber-card-tw border-l-4 border-l-cyber-yellow shadow-cyberInset">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-cyber-yellow/40 bg-bgDark text-cyber-yellow">
                <Clock3 className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-cyber-yellow">
                  Coming Soon
                </h2>
                <p className="max-w-2xl text-xs leading-5 text-textSecondary">
                  This route is live in the app shell and intentionally parked for the next implementation pass.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="grid gap-4 lg:grid-cols-3">
            <ConnectionCard
              icon={Database}
              label="Database"
              value="Ready to wire"
              tone="cyan"
            />
            <ConnectionCard
              icon={PlugZap}
              label="N8N Automation"
              value="Endpoint slot ready"
              tone="green"
            />
            <ConnectionCard
              icon={AlertTriangle}
              label="Dead Buttons"
              value="None in shell"
              tone="yellow"
            />
          </section>
        )}

        {items.length > 0 && (
          <section className="cyber-card-tw shadow-cyberInset">
            <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wider text-cyber-cyan">
              // Included Surface
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <div
                  key={item}
                  className="border border-borderSubtle bg-bgDark px-3 py-2 text-xs text-textSecondary"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}

function StatusBadge({ comingSoon }: { comingSoon: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 border px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-wider",
        comingSoon
          ? "border-cyber-yellow/50 bg-cyber-yellow/10 text-cyber-yellow"
          : "border-cyber-green/50 bg-cyber-green/10 text-cyber-green",
      ].join(" ")}
    >
      {comingSoon ? <Clock3 className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
      {comingSoon ? "Coming Soon" : "Functional Shell"}
    </span>
  );
}

function ConnectionCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "cyan" | "green" | "yellow";
}) {
  const tones = {
    cyan: "text-cyber-cyan border-cyber-cyan/30",
    green: "text-cyber-green border-cyber-green/30",
    yellow: "text-cyber-yellow border-cyber-yellow/30",
  };

  return (
    <div className={`cyber-card-tw ${tones[tone]} shadow-cyberInset`}>
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5" />
        <div>
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-textMuted">
            {label}
          </p>
          <p className="mt-1 text-sm font-semibold text-textPrimary">{value}</p>
        </div>
      </div>
    </div>
  );
}
