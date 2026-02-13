"use client";

import { Search, Bell, Filter, Zap, Terminal } from "lucide-react";

export function TopBar() {
  return (
    <header className="flex items-center justify-between border-b border-borderSubtle bg-bgDark/95 px-4 py-2.5 backdrop-blur-md lg:px-7">
      {/* Search Section */}
      <div className="flex flex-1 items-center gap-3">
        <div className="relative flex-1 max-w-lg">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-textMuted" />
          <input
            className="h-9 w-full border border-borderSubtle bg-bgLight/80 pl-9 pr-3 text-xs text-textPrimary outline-none placeholder:text-textMuted focus:border-cyber-cyan focus:shadow-cyberSm transition-all duration-200"
            placeholder="// Search leads, jobs, installers, suppliers…"
          />
          <kbd className="absolute right-3 top-2 hidden rounded border border-borderSubtle bg-bgMedium px-1.5 py-0.5 text-[9px] text-textMuted sm:block">
            ⌘K
          </kbd>
        </div>

        <button className="inline-flex items-center gap-1.5 border border-borderSubtle bg-surface px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-textSecondary transition-all duration-200 hover:border-cyber-cyan hover:text-cyber-cyan hover:shadow-cyberSm">
          <Filter className="h-3 w-3" />
          <span>Filters</span>
        </button>
      </div>

      {/* Right Section */}
      <div className="ml-4 flex items-center gap-3">
        {/* Quick Actions */}
        <button className="relative inline-flex h-8 w-8 items-center justify-center border border-borderSubtle bg-surface text-textSecondary transition-all duration-200 hover:border-cyber-magenta hover:text-cyber-magenta hover:shadow-cyberMagenta">
          <Terminal className="h-4 w-4" />
        </button>

        {/* Notifications */}
        <button className="relative inline-flex h-8 w-8 items-center justify-center border border-borderSubtle bg-surface text-textSecondary transition-all duration-200 hover:border-cyber-cyan hover:text-cyber-cyan hover:shadow-cyberSm">
          <Bell className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyber-magenta opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyber-magenta shadow-[0_0_6px_rgba(255,0,255,0.8)]" />
          </span>
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-2.5 border border-borderSubtle bg-surface px-3 py-1.5">
          <div className="relative h-6 w-6">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyber-cyan to-cyber-green opacity-60 blur-[2px]" />
            <div className="relative h-full w-full rounded-full bg-gradient-to-br from-cyber-cyan to-cyber-green" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-[11px] font-semibold uppercase tracking-wider text-textPrimary">
              Vulpine Ops
            </div>
            <div className="flex items-center gap-1 text-[9px] text-textMuted">
              <Zap className="h-2.5 w-2.5 text-cyber-green" />
              <span>AEON: Phoenix</span>
              <span className="ml-1 h-1.5 w-1.5 rounded-full bg-cyber-green shadow-[0_0_4px_rgba(0,255,102,0.8)] animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
