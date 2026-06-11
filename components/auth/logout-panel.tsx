"use client";

import { LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

export function LogoutPanel() {
  const { status } = useSession();

  return (
    <button
      type="button"
      disabled={status !== "authenticated"}
      onClick={() => signOut({ callbackUrl: "/" })}
      className="inline-flex items-center gap-2 border border-cyber-magenta bg-cyber-magenta px-4 py-2 text-xs font-bold uppercase tracking-wider text-bgDarkest shadow-cyberMagenta transition hover:bg-transparent hover:text-cyber-magenta disabled:cursor-not-allowed disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </button>
  );
}