import Link from "next/link";
import { LoginPanel } from "@/components/auth/login-panel";

export default function LoginPage() {
  const appIdPresent = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

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
            Use Privy to access protected Vulpine Command Center routes.
          </p>
        </div>
        {appIdPresent ? (
          <LoginPanel />
        ) : (
          <p className="border border-cyber-yellow/50 bg-cyber-yellow/10 px-3 py-2 text-xs text-cyber-yellow">
            Privy public app ID is not configured.
          </p>
        )}
        <Link href="/" className="inline-flex text-xs uppercase tracking-wider text-textSecondary hover:text-cyber-cyan">
          Back to public landing
        </Link>
      </section>
    </main>
  );
}
