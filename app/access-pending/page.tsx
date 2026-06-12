import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function AccessPendingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bgDarkest px-6 text-textPrimary">
      <section className="w-full max-w-xl space-y-5 border border-borderSubtle bg-surface p-6 shadow-cyberInset">
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-cyber-yellow">
          // Access
        </p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">
          Access Checks Disabled
        </h1>
        <p className="text-sm leading-6 text-textSecondary">
          Auth is turned off right now. You can browse the full CRM shell from
          the dashboard.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 border border-cyber-cyan bg-cyber-cyan px-4 py-2 text-xs font-bold uppercase tracking-wider text-bgDarkest shadow-cyberMd transition hover:bg-transparent hover:text-cyber-cyan"
          >
            Go to Dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/"
            className="inline-flex border border-borderSubtle bg-surface px-4 py-2 text-xs font-bold uppercase tracking-wider text-textSecondary transition hover:border-cyber-cyan hover:text-cyber-cyan"
          >
            Public landing
          </Link>
        </div>
      </section>
    </main>
  );
}