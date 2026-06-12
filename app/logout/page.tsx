import Link from "next/link";
import { LogoutPanel } from "@/components/auth/logout-panel";

export default function LogoutPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bgDarkest px-6 text-textPrimary">
      <section className="w-full max-w-xl space-y-6 border border-borderSubtle bg-surface p-6 shadow-cyberInset">
        <div className="space-y-2">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-cyber-magenta">
            // Auth
          </p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide">
            Sign Out
          </h1>
          <p className="text-sm leading-6 text-textSecondary">
            End the current Zitadel session for this browser.
          </p>
        </div>
        <LogoutPanel />
        <Link
          href="/"
          className="inline-flex text-xs uppercase tracking-wider text-textSecondary hover:text-cyber-cyan"
        >
          Back to public landing
        </Link>
      </section>
    </main>
  );
}
