"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PhoneCall,
  FileText,
  Briefcase,
  Users,
  Factory,
  Wrench,
  CreditCard,
  FolderKanban,
  BarChart3,
  Cpu,
  Megaphone,
  ShieldCheck,
  Settings,
  Globe2,
  Sparkles,
  Package,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Pipeline",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Leads", href: "/leads", icon: PhoneCall },
      { label: "Quotes", href: "/quotes", icon: FileText },
      { label: "Jobs", href: "/jobs", icon: Briefcase },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { label: "Homeowners", href: "/homeowners", icon: Users },
      { label: "Installers", href: "/installers", icon: Wrench },
      { label: "Suppliers", href: "/suppliers", icon: Factory },
      { label: "Materials", href: "/materials", icon: Package },
      { label: "Portals", href: "/portals", icon: Globe2 },
      { label: "AR Visualizer", href: "/ar-visualizer", icon: Sparkles },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Work orders", href: "/work-orders", icon: FolderKanban },
      { label: "Payments", href: "/payments", icon: CreditCard },
      { label: "Documents", href: "/documents", icon: FileText },
      { label: "Files", href: "/files", icon: FolderKanban },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Metrics", href: "/metrics", icon: BarChart3 },
      { label: "Automation", href: "/automation", icon: Cpu },
      { label: "Marketing", href: "/marketing", icon: Megaphone },
      { label: "Audit log", href: "/audit-logs", icon: ShieldCheck },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Tenants & users", href: "/tenants-users", icon: Users },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-full w-64 flex-col border-r border-borderSubtle bg-gradient-to-b from-bgDark to-bgDarkest lg:flex cyber-grid">
      {/* Logo Section */}
      <div className="flex items-center gap-3 border-b border-borderSubtle px-5 py-4">
        <div className="relative h-9 w-9">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyber-cyan to-cyber-magenta opacity-80 blur-sm" />
          <div className="relative h-full w-full rounded-full bg-gradient-to-br from-cyber-cyan to-cyber-magenta shadow-cyberMd" />
        </div>
        <div>
          <div className="font-display text-xs font-bold tracking-[0.3em] text-cyber-cyan text-neon-cyan">
            AEON
          </div>
          <div className="text-sm font-medium text-textPrimary">
            Vulpine OS
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto scrollbar-thin px-3 py-5 text-sm">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-2">
            <p className="px-2 font-display text-[10px] font-bold uppercase tracking-[0.25em] text-cyber-cyan text-neon-cyan">
              // {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href !== "/" &&
                    pathname.startsWith(item.href) &&
                    pathname !== "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "group flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-all duration-200 border-l-2",
                      active
                        ? "border-l-cyber-cyan bg-surface text-cyber-cyan shadow-cyberInset"
                        : "border-l-transparent text-textSecondary hover:border-l-cyber-cyan/50 hover:bg-surface/50 hover:text-cyber-cyan",
                    ].join(" ")}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? "drop-shadow-[0_0_4px_rgba(0,240,255,0.8)]" : ""}`} />
                    <span className="truncate uppercase tracking-wide">{item.label}</span>
                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyber-cyan shadow-[0_0_6px_rgba(0,240,255,0.8)] animate-pulse" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-borderSubtle px-4 py-3">
        <div className="text-[9px] font-display uppercase tracking-[0.2em] text-cyber-cyan/60">
          AEON · Advanced Efficient Optimized Network
        </div>
        <div className="mt-1 text-[9px] text-textMuted">
          Vulpine OS · v2.0 · <span className="text-cyber-green">● ONLINE</span>
        </div>
      </div>
    </aside>
  );
}
