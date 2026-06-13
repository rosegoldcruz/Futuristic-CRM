import Link from "next/link";
import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { AppUser } from "@/lib/auth/access";

export const mailNav = [
  ["/mail", "Dashboard"],
  ["/mail/send", "Send"],
  ["/mail/contacts", "Contacts"],
  ["/mail/companies", "Companies"],
  ["/mail/lists", "Lists"],
  ["/mail/templates", "Templates"],
  ["/mail/campaigns", "Campaigns"],
  ["/mail/events", "Events"],
  ["/mail/settings", "Settings"],
  ["/mail/suppressions", "Suppressions"],
] as const;

export function MailShell({ user, title, children }: { user: AppUser; title: string; children: ReactNode }) {
  return (
    <DashboardShell user={user}>
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-cyber-cyan">
              // Mail Operations
            </p>
            <h1 className="mt-2 font-display text-2xl font-bold uppercase tracking-wide text-textPrimary md:text-3xl">
              {title}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {mailNav.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="inline-flex h-8 items-center justify-center border border-borderSubtle bg-surface px-3 font-display text-xs font-medium uppercase tracking-wider text-textPrimary transition-all hover:border-cyber-cyan hover:text-cyber-cyan"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        {children}
      </div>
    </DashboardShell>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="cyber-card-tw shadow-cyberInset">
      <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wider text-cyber-cyan">
        // {title}
      </h2>
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-xs uppercase tracking-wide text-textSecondary">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function inputClass() {
  return "input-cyber min-h-10";
}

export function textAreaClass() {
  return "input-cyber min-h-32";
}

export function Badge({ children, tone = "cyan" }: { children: ReactNode; tone?: "cyan" | "green" | "yellow" | "red" | "muted" }) {
  const tones = {
    cyan: "border-cyber-cyan/40 text-cyber-cyan",
    green: "border-cyber-green/40 text-cyber-green",
    yellow: "border-cyber-yellow/40 text-cyber-yellow",
    red: "border-cyber-red/40 text-cyber-red",
    muted: "border-borderSubtle text-textSecondary",
  };
  return <span className={`inline-flex border px-2 py-1 text-[10px] uppercase tracking-wide ${tones[tone]}`}>{children}</span>;
}
