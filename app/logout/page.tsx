import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function LogoutPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bgDarkest px-6 text-textPrimary">
      <section className="w-full max-w-xl space-y-6 border border-borderSubtle bg-surface p-6 shadow-cyberInset">
        <div className="space-y-2">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-cyber-magenta">
            // Access
          </p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide">
            Auth Disabled
          </h1>
          <p className="text-sm leading-6 text-textSecondary">
            There is no active sign-out flow while authentication is turned off.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 border border-cyber-cyan bg-cyber-cyan px-4 py-2 text-xs font-bold uppercase tracking-wider text-bgDarkest shadow-cyberMd transition hover:bg-transparent hover:text-cyber-cyan"
        >
          Back to Dashboard
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}