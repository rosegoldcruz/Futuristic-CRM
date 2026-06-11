"use client";

import { useLogin, usePrivy } from "@privy-io/react-auth";
import { LogIn } from "lucide-react";

export function LoginPanel() {
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();

  return (
    <button
      type="button"
      disabled={!ready || authenticated}
      onClick={() => login()}
      className="inline-flex items-center gap-2 border border-cyber-cyan bg-cyber-cyan px-4 py-2 text-xs font-bold uppercase tracking-wider text-bgDarkest shadow-cyberMd transition hover:bg-transparent hover:text-cyber-cyan disabled:cursor-not-allowed disabled:opacity-60"
    >
      <LogIn className="h-4 w-4" />
      {authenticated ? "Authenticated" : "Sign in with Privy"}
    </button>
  );
}
