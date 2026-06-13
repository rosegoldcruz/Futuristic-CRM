"use client";

import type { UserRole } from "@prisma/client";
import { LogOut, ShieldCheck, Zap } from "lucide-react";

export function TopBar({
  user,
}: {
  user: {
    email: string;
    name: string | null;
    role: UserRole;
  };
}) {
  return (
    <header className="flex items-center justify-between border-b border-borderSubtle bg-bgDark/95 px-4 py-2.5 backdrop-blur-md lg:px-7">
      <div className="flex flex-1 items-center gap-3">
        <div className="inline-flex items-center gap-2 border border-borderSubtle bg-surface px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-textSecondary">
          <ShieldCheck className="h-3.5 w-3.5 text-cyber-green" />
          Protected Command Shell
        </div>
      </div>

      <div className="ml-4 flex items-center gap-3">
        <div className="flex items-center gap-2.5 border border-borderSubtle bg-surface px-3 py-1.5">
          <div className="relative h-6 w-6">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyber-cyan to-cyber-green opacity-60 blur-[2px]" />
            <div className="relative h-full w-full rounded-full bg-gradient-to-br from-cyber-cyan to-cyber-green" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-[11px] font-semibold uppercase tracking-wider text-textPrimary">
              {user.name || user.email}
            </div>
            <div className="flex items-center gap-1 text-[9px] text-textMuted">
              <Zap className="h-2.5 w-2.5 text-cyber-green" />
              <span>{user.role}</span>
              <span className="ml-1 h-1.5 w-1.5 rounded-full bg-cyber-green shadow-[0_0_4px_rgba(0,255,102,0.8)] animate-pulse" />
            </div>
          </div>
        </div>
        <a
          href="/api/auth/logout"
          className="inline-flex items-center gap-2 border border-borderSubtle bg-surface px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-textSecondary transition hover:border-cyber-magenta hover:text-cyber-magenta"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </a>
      </div>
    </header>
  );
}
