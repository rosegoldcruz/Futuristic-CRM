"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm({ authConfigured }: { authConfigured: boolean }) {
  const router = useRouter();
  const { status } = useSession();
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  async function handleSignIn() {
    if (
      !authConfigured ||
      status === "loading" ||
      status === "authenticated" ||
      isSigningIn
    ) {
      return;
    }

    setIsSigningIn(true);
    await signIn("zitadel", { callbackUrl: "/dashboard" });
    setIsSigningIn(false);
  }

  const isLoading = status === "loading";

  return (
    <main className="flex min-h-screen items-center justify-center bg-bgDarkest px-6 text-textPrimary">
      <section className="w-full max-w-xl space-y-6 border border-borderSubtle bg-surface p-6 shadow-cyberInset">
        <div className="space-y-2">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-cyber-cyan">
            // Auth
          </p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide">
            Sign In
          </h1>
          <p className="text-sm leading-6 text-textSecondary">
            Use Zitadel to access protected Vulpine Command Center routes.
          </p>
        </div>

        {!authConfigured && (
          <p className="border border-cyber-yellow/50 bg-cyber-yellow/10 px-3 py-2 text-xs text-cyber-yellow">
            Zitadel is not configured yet. Set ZITADEL_ISSUER, ZITADEL_CLIENT_ID,
            and ZITADEL_CLIENT_SECRET in the server environment.
          </p>
        )}

        {isLoading && (
          <p className="text-xs text-cyber-yellow">Checking session...</p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handleSignIn}
            disabled={
              !authConfigured ||
              isLoading ||
              status === "authenticated" ||
              isSigningIn
            }
            className="inline-flex items-center gap-2 border border-cyber-cyan bg-cyber-cyan px-4 py-2 text-xs font-bold uppercase tracking-wider text-bgDarkest shadow-cyberMd transition hover:bg-transparent hover:text-cyber-cyan disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {!authConfigured
              ? "Auth Not Configured"
              : isLoading
                ? "Loading..."
                : isSigningIn
                  ? "Redirecting..."
                  : status === "authenticated"
                    ? "Authenticated"
                    : "Sign in with Zitadel"}
          </button>

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