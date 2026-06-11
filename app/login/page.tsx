"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

export default function LoginPage() {
  const router = useRouter();
  const { ready, authenticated, login } = usePrivy();

  useEffect(() => {
    if (ready && authenticated) {
      router.push("/dashboard");
    }
  }, [ready, authenticated, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070d] px-6 text-white">
      <section className="w-full max-w-xl border border-cyan-500/40 bg-slate-950/80 p-8 shadow-[0_0_40px_rgba(0,240,255,0.12)]">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">
          // Auth
        </p>
        <h1 className="mt-4 text-3xl font-bold uppercase tracking-wide">
          Sign In
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          Use Privy to access protected Vulpine Command Center routes.
        </p>

        {!ready && (
          <p className="mt-4 text-xs text-yellow-300">
            Loading Privy client...
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => login()}
            disabled={!ready}
            className="border border-cyan-400 px-5 py-3 text-sm font-semibold uppercase tracking-widest text-cyan-300 transition hover:bg-cyan-400 hover:text-black disabled:cursor-wait disabled:opacity-50"
          >
            {ready ? "Sign in with Privy" : "Loading Privy..."}
          </button>

          <Link
            href="/"
            className="text-xs uppercase tracking-widest text-slate-400 hover:text-cyan-300"
          >
            Back to public landing
          </Link>
        </div>
      </section>
    </main>
  );
}
