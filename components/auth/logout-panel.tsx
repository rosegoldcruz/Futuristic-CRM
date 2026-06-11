"use client";

import { useLogout, usePrivy } from "@privy-io/react-auth";
import { LogOut } from "lucide-react";

export function LogoutPanel() {
  const { ready, authenticated } = usePrivy();
  const { logout } = useLogout();

  return (
    <button
      type="button"
      disabled={!ready || !authenticated}
      onClick={() => logout()}
      className="inline-flex items-center gap-2 border border-cyber-magenta bg-cyber-magenta px-4 py-2 text-xs font-bold uppercase tracking-wider text-bgDarkest shadow-cyberMagenta transition hover:bg-transparent hover:text-cyber-magenta disabled:cursor-not-allowed disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </button>
  );
}
