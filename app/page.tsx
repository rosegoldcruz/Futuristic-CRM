import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-bgDarkest text-textPrimary">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16">
        <div className="max-w-3xl space-y-7">
          <div className="inline-flex items-center gap-2 border border-borderSubtle bg-surface px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyber-cyan">
            <ShieldCheck className="h-3.5 w-3.5" />
            crm.vulpinehomes.com
          </div>
          <div className="space-y-4">
            <h1 className="font-display text-4xl font-black uppercase tracking-wide text-textPrimary sm:text-6xl">
              Vulpine Command Center
            </h1>
            <p className="max-w-2xl text-base leading-7 text-textSecondary">
              Public entry point for the Vulpine CRM shell. Auth is temporarily
              disabled so you can browse the build.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 border border-cyber-cyan bg-cyber-cyan px-4 py-2 text-xs font-bold uppercase tracking-wider text-bgDarkest shadow-cyberMd transition hover:bg-transparent hover:text-cyber-cyan"
            >
              Enter Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 border border-borderSubtle bg-surface px-4 py-2 text-xs font-bold uppercase tracking-wider text-textSecondary transition hover:border-cyber-cyan hover:text-cyber-cyan"
            >
              Login page
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}