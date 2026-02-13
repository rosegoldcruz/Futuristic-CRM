"use client";

import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#050711] text-slate-100">
      <Sidebar />
      <div className="flex min-h-0 flex-1 flex-col">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
