"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  ClipboardList,
  DatabaseZap,
  FileText,
  FolderKanban,
  Gavel,
  Home,
  Layers3,
  LayoutDashboard,
  ListChecks,
  Send,
  Settings,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useState } from "react";
import type { ComponentType } from "react";

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  children?: NavItem[];
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const EMAIL_ENGINE_ITEMS: NavItem[] = [
  { label: "Overview", href: "/email-engine/overview", icon: LayoutDashboard },
  { label: "Contacts", href: "/email-engine/contacts", icon: CircleUserRound },
  { label: "Companies", href: "/email-engine/companies", icon: Building2 },
  { label: "Lists", href: "/email-engine/lists", icon: Layers3 },
  { label: "Templates", href: "/email-engine/templates", icon: FileText },
  { label: "Campaigns", href: "/email-engine/campaigns", icon: Send },
  { label: "Queue", href: "/email-engine/queue", icon: ClipboardList },
  { label: "Exports", href: "/email-engine/exports", icon: DatabaseZap },
  { label: "Deliverability", href: "/email-engine/deliverability", icon: ShieldCheck },
  { label: "Compliance", href: "/email-engine/compliance", icon: Gavel },
  { label: "Settings", href: "/email-engine/settings", icon: Settings },
];

const MAIL_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/mail", icon: LayoutDashboard },
  { label: "Send", href: "/mail/send", icon: Send },
  { label: "Contacts", href: "/mail/contacts", icon: CircleUserRound },
  { label: "Companies", href: "/mail/companies", icon: Building2 },
  { label: "Lists", href: "/mail/lists", icon: Layers3 },
  { label: "Templates", href: "/mail/templates", icon: FileText },
  { label: "Campaigns", href: "/mail/campaigns", icon: Send },
  { label: "Events", href: "/mail/events", icon: Activity },
  { label: "Settings", href: "/mail/settings", icon: Settings },
  { label: "Suppressions", href: "/mail/suppressions", icon: ShieldCheck },
];

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Core",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: Home },
      { label: "Leads", href: "/leads", icon: ListChecks },
      { label: "Contacts", href: "/contacts", icon: CircleUserRound },
      { label: "Email Engine", href: "/email-engine", icon: Send, children: EMAIL_ENGINE_ITEMS },
      { label: "Mail Ops", href: "/mail", icon: Send, children: MAIL_ITEMS },
      { label: "Automations", href: "/automations", icon: Zap },
    ],
  },
  {
    label: "Contacts & Companies",
    items: [
      { label: "Leads", href: "/leads", icon: ListChecks },
      { label: "Contacts", href: "/contacts", icon: CircleUserRound },
      { label: "Companies", href: "/email-engine/companies", icon: Building2 },
    ],
  },
  {
    label: "Revenue",
    items: [
      {
        label: "Revenue",
        href: "/bid-opportunities",
        icon: FolderKanban,
        children: [
          { label: "Bid Opportunities", href: "/bid-opportunities", icon: Gavel },
          { label: "Quote Pipeline", href: "/quote-pipeline", icon: FolderKanban },
          { label: "Suppliers", href: "/suppliers", icon: Building2 },
          { label: "Projects", href: "/projects", icon: ClipboardList },
        ],
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    "Email Engine": true,
    "Mail Ops": true,
    Revenue: true,
  });

  const isActive = (href: string, children?: NavItem[]) =>
    pathname === href ||
    Boolean(children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`))) ||
    (href === "/email-engine" && pathname.startsWith("/email-engine/")) ||
    (href === "/mail" && pathname.startsWith("/mail/")) ||
    (href !== "/dashboard" && href !== "/email-engine" && href !== "/mail" && pathname.startsWith(`${href}/`));

  return (
    <aside
      className={[
        "hidden h-full flex-col border-r border-borderSubtle bg-gradient-to-b from-bgDark to-bgDarkest transition-all duration-200 lg:flex cyber-grid",
        collapsed ? "w-20" : "w-72",
      ].join(" ")}
    >
      <div className="flex items-center gap-3 border-b border-borderSubtle px-4 py-4">
        <div className="relative h-9 w-9">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyber-cyan to-cyber-magenta opacity-80 blur-sm" />
          <div className="relative h-full w-full rounded-full bg-gradient-to-br from-cyber-cyan to-cyber-magenta shadow-cyberMd" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-display text-xs font-bold uppercase tracking-[0.24em] text-cyber-cyan text-neon-cyan">
              Vulpine
            </div>
            <div className="truncate text-sm font-medium text-textPrimary">
              Command Center
            </div>
          </div>
        )}
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((value) => !value)}
          className="ml-auto inline-flex h-8 w-8 items-center justify-center border border-borderSubtle bg-surface text-textSecondary hover:border-cyber-cyan hover:text-cyber-cyan"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto scrollbar-thin px-3 py-5 text-sm">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="space-y-2">
            <div
              className={[
                "flex w-full items-center justify-between px-2 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-cyber-cyan text-neon-cyan",
                collapsed ? "justify-center px-0" : "",
              ].join(" ")}
            >
              <span>{collapsed ? "//" : `// ${section.label}`}</span>
            </div>

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const itemHasChildren = Boolean(item.children?.length);
                const itemOpen = openItems[item.label] ?? isActive(item.href, item.children);
                const active = isActive(item.href, item.children);

                return (
                  <div key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={[
                        "group flex items-center gap-2.5 border-l-2 px-3 py-2 text-xs font-medium transition-all duration-200",
                        collapsed ? "justify-center px-2" : "",
                        active
                          ? "border-l-cyber-cyan bg-surface text-cyber-cyan shadow-cyberInset"
                          : "border-l-transparent text-textSecondary hover:border-l-cyber-cyan/50 hover:bg-surface/50 hover:text-cyber-cyan",
                      ].join(" ")}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "drop-shadow-[0_0_4px_rgba(0,240,255,0.8)]" : ""}`} />
                      {!collapsed && <span className="truncate uppercase tracking-wide">{item.label}</span>}
                      {itemHasChildren && !collapsed && (
                        <button
                          type="button"
                          aria-label={`${itemOpen ? "Collapse" : "Expand"} ${item.label}`}
                          onClick={(event) => {
                            event.preventDefault();
                            setOpenItems((current) => ({
                              ...current,
                              [item.label]: !itemOpen,
                            }));
                          }}
                          className="ml-auto inline-flex h-5 w-5 items-center justify-center text-textMuted hover:text-cyber-cyan"
                        >
                          <ChevronDown
                            className={[
                              "h-3.5 w-3.5 transition-transform",
                              itemOpen ? "rotate-0" : "-rotate-90",
                            ].join(" ")}
                          />
                        </button>
                      )}
                      {active && !collapsed && !itemHasChildren && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyber-cyan shadow-[0_0_6px_rgba(0,240,255,0.8)] animate-pulse" />
                      )}
                    </Link>

                    {itemHasChildren && itemOpen && !collapsed && (
                      <div className="ml-4 mt-1 space-y-0.5 border-l border-borderSubtle/60 pl-2">
                        {item.children?.map((child) => {
                          const ChildIcon = child.icon;
                          const childActive = isActive(child.href);

                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={[
                                "group flex items-center gap-2 border-l-2 px-3 py-1.5 text-[11px] font-medium transition-all duration-200",
                                childActive
                                  ? "border-l-cyber-cyan bg-surface text-cyber-cyan shadow-cyberInset"
                                  : "border-l-transparent text-textSecondary hover:border-l-cyber-cyan/50 hover:bg-surface/50 hover:text-cyber-cyan",
                              ].join(" ")}
                            >
                              <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate uppercase tracking-wide">{child.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="border-t border-borderSubtle px-4 py-3">
          <div className="text-[9px] font-display uppercase tracking-[0.2em] text-cyber-cyan/60">
            CRM Shell
          </div>
          <div className="mt-1 text-[9px] text-textMuted">
            Approved routes only | <span className="text-cyber-green">ONLINE</span>
          </div>
        </div>
      )}
    </aside>
  );
}
