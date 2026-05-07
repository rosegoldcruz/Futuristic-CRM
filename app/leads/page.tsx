// TODO: reconnect to Postgres/Supabase when backend is available.
// Currently using local mock data so the UI works as a portfolio-ready MVP.
"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { mockLeads } from "@/app/lib/mockData";
import type { Lead } from "@/app/lib/mockData";
import { DetailField, DetailModal } from "@/components/ui/detail-modal";

const STATUS_COLORS: Record<Lead["status"], string> = {
  new: "bg-textMuted/20 border-textMuted/50 text-textMuted",
  contacted: "bg-cyber-cyan/10 border-cyber-cyan/50 text-cyber-cyan",
  qualified: "bg-cyber-yellow/10 border-cyber-yellow/50 text-cyber-yellow",
  hot: "bg-cyber-red/10 border-cyber-red/50 text-cyber-red",
  "quote-ready": "bg-cyber-green/10 border-cyber-green/50 text-cyber-green",
  lost: "bg-bgLighter/50 border-borderSubtle text-textMuted",
};

const PRIORITY_COLORS: Record<Lead["priority"], string> = {
  high: "text-cyber-red",
  medium: "text-cyber-yellow",
  low: "text-textMuted",
};

function StatusBadge({ status }: { status: Lead["status"] }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      {status.replace("-", " ")}
    </span>
  );
}

function KpiCard({
  label,
  value,
  variant = "cyan",
}: {
  label: string;
  value: string | number;
  variant?: "cyan" | "magenta" | "yellow" | "green" | "red";
}) {
  const colors = {
    cyan: { border: "border-cyber-cyan/30", text: "text-cyber-cyan", glow: "rgba(0,240,255,0.5)" },
    magenta: { border: "border-cyber-magenta/30", text: "text-cyber-magenta", glow: "rgba(255,0,255,0.5)" },
    yellow: { border: "border-cyber-yellow/30", text: "text-cyber-yellow", glow: "rgba(255,230,0,0.5)" },
    green: { border: "border-cyber-green/30", text: "text-cyber-green", glow: "rgba(0,255,102,0.5)" },
    red: { border: "border-cyber-red/30", text: "text-cyber-red", glow: "rgba(255,0,68,0.5)" },
  };
  const c = colors[variant];
  return (
    <div className={`cyber-card-tw ${c.border} shadow-cyberInset`}>
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-textMuted">// {label}</p>
      <p className={`mt-2 text-2xl font-bold font-display ${c.text}`} style={{ textShadow: `0 0 15px ${c.glow}` }}>
        {value}
      </p>
    </div>
  );
}

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const leads = mockLeads;

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const matchSearch =
        !search ||
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.city.toLowerCase().includes(search.toLowerCase()) ||
        l.projectType.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || l.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [leads, search, statusFilter]);

  const newCount = leads.filter((l) => l.status === "new").length;
  const hotCount = leads.filter((l) => l.status === "hot").length;
  const followUpCount = leads.filter((l) => l.nextFollowUp <= "2025-05-09").length;
  const quoteReadyCount = leads.filter((l) => l.status === "quote-ready").length;

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1
            className="font-display text-3xl font-bold uppercase tracking-wider text-cyber-cyan"
            style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}
          >
            Leads
          </h1>
          <p className="text-sm text-textSecondary font-mono">
            // Live intake queue for homeowner and marketplace opportunities
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="New Leads" value={newCount} variant="cyan" />
          <KpiCard label="Hot Leads" value={hotCount} variant="red" />
          <KpiCard label="Follow-Up Due" value={followUpCount} variant="yellow" />
          <KpiCard label="Quote Ready" value={quoteReadyCount} variant="green" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search name, city, project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 border border-borderSubtle bg-surface px-3 py-2 text-xs text-textPrimary placeholder-textMuted focus:border-cyber-cyan/60 focus:outline-none font-mono"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-borderSubtle bg-surface px-3 py-2 text-xs text-textPrimary focus:border-cyber-cyan/60 focus:outline-none font-mono"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="hot">Hot</option>
            <option value="quote-ready">Quote Ready</option>
            <option value="lost">Lost</option>
          </select>
          <span className="text-xs text-textMuted font-mono">
            {filtered.length} / {leads.length} records
          </span>
        </div>

        {/* Table */}
        <section className="cyber-card-tw border-l-4 border-l-cyber-cyan shadow-cyberInset overflow-x-auto p-0">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-borderSubtle bg-bgDark">
                {["Name", "City", "Project Type", "Source", "Budget", "Status", "Priority", "Next Follow-Up"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left font-display text-[10px] uppercase tracking-[0.15em] text-cyber-cyan/70"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-textMuted font-mono">
                    // No leads match filter
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => (
                  <tr
                    key={lead.id}
                    className="cursor-pointer border-b border-borderSubtle transition-colors hover:bg-surface/60"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <td className="px-4 py-3 font-medium text-textPrimary whitespace-nowrap">
                      <div>{lead.name}</div>
                      <div className="text-[10px] text-textMuted font-mono">{lead.id}</div>
                    </td>
                    <td className="px-4 py-3 text-textSecondary">{lead.city}</td>
                    <td className="px-4 py-3 text-textSecondary">{lead.projectType}</td>
                    <td className="px-4 py-3 text-textMuted">{lead.source}</td>
                    <td className="px-4 py-3 text-textSecondary font-mono">{lead.budgetRange}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className={`px-4 py-3 font-bold uppercase ${PRIORITY_COLORS[lead.priority]}`}>
                      {lead.priority}
                    </td>
                    <td className="px-4 py-3 text-textMuted font-mono">{lead.nextFollowUp}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
      {selectedLead ? (
        <DetailModal
          title={`Lead Card — ${selectedLead.name}`}
          subtitle={`${selectedLead.id} • ${selectedLead.projectType}`}
          onClose={() => setSelectedLead(null)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Phone" value={selectedLead.phone} />
            <DetailField label="Email" value={selectedLead.email} />
            <DetailField label="Address" value={selectedLead.address} />
            <DetailField label="City" value={selectedLead.city} />
            <DetailField label="Source" value={selectedLead.source} />
            <DetailField label="Budget Range" value={selectedLead.budgetRange} />
            <DetailField label="Status" value={selectedLead.status} />
            <DetailField label="Priority" value={selectedLead.priority} />
            <DetailField label="Call Disposition" value={selectedLead.callDisposition.replace("-", " ")} />
            <DetailField label="Next Follow-Up" value={selectedLead.nextFollowUp} />
          </div>
          <div className="mt-3 border border-borderSubtle/80 bg-surface/40 px-3 py-2">
            <p className="text-[10px] font-display font-bold uppercase tracking-[0.15em] text-cyber-cyan/70">Notes</p>
            <p className="mt-1 text-sm text-textPrimary">{selectedLead.notes}</p>
          </div>
        </DetailModal>
      ) : null}
    </DashboardShell>
  );
}
