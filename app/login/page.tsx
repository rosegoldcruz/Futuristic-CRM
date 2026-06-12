import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bgDarkest px-6 text-textPrimary">
      <section className="w-full max-w-xl space-y-6 border border-borderSubtle bg-surface p-6 shadow-cyberInset">
        <div className="space-y-2">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-cyber-cyan">
            // Access
          </p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide">
            Enter Command Center
          </h1>
          <p className="text-sm leading-6 text-textSecondary">
            Auth is disabled for now. Jump straight into the CRM shell.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 border border-cyber-cyan bg-cyber-cyan px-4 py-2 text-xs font-bold uppercase tracking-wider text-bgDarkest shadow-cyberMd transition hover:bg-transparent hover:text-cyber-cyan"
          >
            Go to Dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            href="/"
            className="text-xs uppercase tracking-wider text-textSecondary hover:text-cyber-cyan"
          >
            Back to public landing
          </Link>
        </div>
      </section>
    </main>
  );
}