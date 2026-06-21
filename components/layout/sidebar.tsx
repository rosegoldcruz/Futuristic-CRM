"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  ClipboardList,
  DatabaseZap,
  FileDown,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Gavel,
  Home,
  Layers3,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MoreHorizontal,
  Ruler,
  Send,
  Settings,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useState } from "react";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";

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
    label: "Platform",
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
    label: "Companies",
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
  {
    label: "Estimating",
    items: [
      { label: "Autobid", href: "/estimating/autobid", icon: Calculator },
      { label: "Projects", href: "/estimating/projects", icon: FolderKanban },
      { label: "Cabinet Takeoffs", href: "/estimating/cabinet-takeoffs", icon: Ruler },
      { label: "Workbook Pricing", href: "/estimating/workbook-pricing", icon: FileSpreadsheet },
      { label: "Bid Exports", href: "/estimating/bid-exports", icon: FileDown },
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

  const menuButtonClass = (active: boolean) =>
    cn(
      "group flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm font-medium transition-colors",
      "text-slate-300 hover:bg-white/[0.06] hover:text-white",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan/50",
      collapsed && "justify-center px-0",
      active && "bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]",
    );

  return (
    <aside
      className={cn(
        "hidden h-full shrink-0 flex-col border-r border-white/10 bg-[#0d0d0f] text-slate-100 transition-[width] duration-200 lg:flex",
        collapsed ? "w-[4.5rem]" : "w-72",
      )}
    >
      <div className="flex flex-col gap-2 border-b border-white/10 p-2">
        <div className="flex items-center gap-2 rounded-lg px-2 py-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cyber-cyan text-sm font-bold text-bgDarkest shadow-[0_0_16px_rgba(0,240,255,0.28)]">
            VC
          </div>
          {!collapsed && (
            <div className="grid min-w-0 flex-1 leading-tight">
              <span className="truncate text-sm font-semibold text-white">Vulpine Command</span>
              <span className="truncate text-xs text-slate-400">CRM Platform</span>
            </div>
          )}
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((value) => !value)}
            className="ml-auto flex size-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin p-2">
        <div className="flex flex-col gap-4">
          {NAV_SECTIONS.map((section) => (
            <section key={section.label} className="space-y-1">
              {!collapsed && (
                <div className="px-2 py-1.5 text-xs font-medium text-slate-500">
                  {section.label}
                </div>
              )}

              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const itemHasChildren = Boolean(item.children?.length);
                  const itemOpen = openItems[item.label] ?? isActive(item.href, item.children);
                  const active = isActive(item.href, item.children);

                  if (itemHasChildren) {
                    return (
                      <div key={item.href} className="space-y-1">
                        <button
                          type="button"
                          title={collapsed ? item.label : undefined}
                          aria-expanded={itemOpen}
                          onClick={() =>
                            setOpenItems((current) => ({
                              ...current,
                              [item.label]: !itemOpen,
                            }))
                          }
                          className={menuButtonClass(active)}
                        >
                          <Icon className="size-4 shrink-0 text-slate-400 transition group-hover:text-white" />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                          {!collapsed && (
                            <ChevronDown
                              className={cn(
                                "ml-auto size-4 text-slate-500 transition-transform duration-200 group-hover:text-white",
                                itemOpen ? "rotate-0" : "-rotate-90",
                              )}
                            />
                          )}
                        </button>

                        {itemOpen && !collapsed && (
                          <div className="ml-4 border-l border-white/10 pl-2">
                            <div className="space-y-1 py-1">
                              {item.children?.map((child) => {
                                const childActive = isActive(child.href);

                                return (
                                  <Link
                                    key={child.href}
                                    href={child.href}
                                    className={cn(
                                      "flex h-8 items-center rounded-md px-2 text-sm transition-colors",
                                      "text-slate-400 hover:bg-white/[0.06] hover:text-white",
                                      childActive && "bg-white/[0.08] text-white",
                                    )}
                                  >
                                    <span className="truncate">{child.label}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={menuButtonClass(active)}
                    >
                      <Icon className="size-4 shrink-0 text-slate-400 transition group-hover:text-white" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </nav>

      <div className="border-t border-white/10 p-2">
        {!collapsed ? (
          <div className="flex items-center gap-2 rounded-lg px-2 py-2 transition hover:bg-white/[0.06]">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-semibold text-white">
              VC
            </div>
            <div className="grid min-w-0 flex-1 leading-tight">
              <span className="truncate text-sm font-semibold text-white">Command Center</span>
              <span className="truncate text-xs text-slate-500">Online</span>
            </div>
            <MoreHorizontal className="size-4 text-slate-500" />
          </div>
        ) : (
          <a
            href="/api/auth/logout"
            title="Sign out"
            className="flex size-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            <LogOut className="size-4" />
          </a>
        )}
      </div>
    </aside>
  );
}
