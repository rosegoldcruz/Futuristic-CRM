"use client";

import type { UserRole } from "@prisma/client";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";

export function DashboardShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: {
    email: string;
    name: string | null;
    role: UserRole;
  };
}) {
  const shellUser = user ?? {
    email: "shell@vulpine.local",
    name: "Shell Preview",
    role: "USER" as UserRole,
  };

  return (
    <div className="flex h-screen bg-[#050711] text-slate-100">
      <Sidebar />
      <div className="flex min-h-0 flex-1 flex-col">
        <TopBar user={shellUser} />
        <main className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
