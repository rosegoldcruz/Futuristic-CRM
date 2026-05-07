// TODO: reconnect to Postgres/Supabase when backend is available.
// Currently using local mock data so the UI works as a portfolio-ready MVP.
"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { mockQuotes } from "@/app/lib/mockData";
import type { Quote } from "@/app/lib/mockData";
import { DetailField, DetailModal } from "@/components/ui/detail-modal";

const STATUS_COLORS: Record<Quote["status"], string> = {
  draft: "bg-textMuted/20 border-textMuted/50 text-textMuted",
  sent: "bg-cyber-cyan/10 border-cyber-cyan/50 text-cyber-cyan",
  pending: "bg-cyber-yellow/10 border-cyber-yellow/50 text-cyber-yellow",
  won: "bg-cyber-green/10 border-cyber-green/50 text-cyber-green",
  lost: "bg-bgLighter/50 border-borderSubtle text-textMuted",
  expired: "bg-cyber-red/10 border-cyber-red/50 text-cyber-red",
};

function StatusBadge({ status }: { status: Quote["status"] }) {
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      {status}
    </span>
  );
}

function KpiCard({ label, value, variant = "cyan" }: { label: string; value: string | number; variant?: "cyan" | "magenta" | "yellow" | "green" }) {
  const colors = {
    cyan: { border: "border-cyber-cyan/30", text: "text-cyber-cyan", glow: "rgba(0,240,255,0.5)" },
    magenta: { border: "border-cyber-magenta/30", text: "text-cyber-magenta", glow: "rgba(255,0,255,0.5)" },
    yellow: { border: "border-cyber-yellow/30", text: "text-cyber-yellow", glow: "rgba(255,230,0,0.5)" },
    green: { border: "border-cyber-green/30", text: "text-cyber-green", glow: "rgba(0,255,102,0.5)" },
  };
  const c = colors[variant];
  return (
    <div className={`cyber-card-tw ${c.border} shadow-cyberInset`}>
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-textMuted">// {label}</p>
      <p className={`mt-2 text-2xl font-bold font-display ${c.text}`} style={{ textShadow: `0 0 15px ${c.glow}` }}>{value}</p>
    </div>
  );
}

export default function QuotesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  const quotes = mockQuotes;

  const filtered = useMemo(() => {
    return quotes.filter((q) => {
      const matchSearch =
        !search ||
        q.customerName.toLowerCase().includes(search.toLowerCase()) ||
        q.city.toLowerCase().includes(search.toLowerCase()) ||
        q.projectType.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || q.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [quotes, search, statusFilter]);

  const sentCount = quotes.filter((q) => q.status === "sent").length;
  const pendingCount = quotes.filter((q) => q.status === "pending").length;
  const wonCount = quotes.filter((q) => q.status === "won").length;
  const totalValue = quotes.reduce((sum, q) => sum + q.amount, 0);

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1
            className="font-display text-3xl font-bold uppercase tracking-wider text-cyber-cyan"
            style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}
          >
            Quotes
          </h1>
          <p className="text-sm text-textSecondary font-mono">
            // Quote pipeline and proposal tracking
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Quotes Sent" value={sentCount} variant="cyan" />
          <KpiCard label="Pending Approval" value={pendingCount} variant="yellow" />
          <KpiCard label="Won Quotes" value={wonCount} variant="green" />
          <KpiCard label="Total Quoted Value" value={`$${(totalValue / 1000).toFixed(0)}K`} variant="magenta" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search customer, city, project..."
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
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="pending">Pending</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="expired">Expired</option>
          </select>
          <span className="text-xs text-textMuted font-mono">{filtered.length} / {quotes.length} records</span>
        </div>

        {/* Table */}
        <section className="cyber-card-tw border-l-4 border-l-cyber-cyan shadow-cyberInset overflow-x-auto p-0">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-borderSubtle bg-bgDark">
                {["Quote", "Customer", "Project", "City", "Amount", "Status", "Sent", "Valid Until", "Rep", "Probability"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-display text-[10px] uppercase tracking-[0.15em] text-cyber-cyan/70">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-textMuted font-mono">// No quotes match filter</td>
                </tr>
              ) : (
                filtered.map((q) => (
                  <tr
                    key={q.id}
                    className="cursor-pointer border-b border-borderSubtle transition-colors hover:bg-surface/60"
                    onClick={() => setSelectedQuote(q)}
                  >
                    <td className="px-4 py-3 font-mono text-textMuted">{q.id}</td>
                    <td className="px-4 py-3 font-medium text-textPrimary whitespace-nowrap">{q.customerName}</td>
                    <td className="px-4 py-3 text-textSecondary">{q.projectType}</td>
                    <td className="px-4 py-3 text-textSecondary">{q.city}</td>
                    <td className="px-4 py-3 font-mono text-cyber-green font-bold">${q.amount.toLocaleString()}</td>
                    <td className="px-4 py-3"><StatusBadge status={q.status} /></td>
                    <td className="px-4 py-3 text-textMuted font-mono">{q.sentAt}</td>
                    <td className="px-4 py-3 text-textMuted font-mono">{q.validUntil}</td>
                    <td className="px-4 py-3 text-textSecondary">{q.assignedRep}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-bgLighter overflow-hidden">
                          <div
                            className="h-full rounded-full bg-cyber-cyan"
                            style={{ width: `${q.probability}%`, opacity: 0.8 }}
                          />
                        </div>
                        <span className="text-textMuted font-mono">{q.probability}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
      {selectedQuote ? (
        <DetailModal
          title={`Quote Card — ${selectedQuote.id}`}
          subtitle={`${selectedQuote.customerName} • ${selectedQuote.projectType}`}
          onClose={() => setSelectedQuote(null)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Customer" value={selectedQuote.customerName} />
            <DetailField label="Project Type" value={selectedQuote.projectType} />
            <DetailField label="City" value={selectedQuote.city} />
            <DetailField label="Amount" value={`$${selectedQuote.amount.toLocaleString()}`} />
            <DetailField label="Status" value={selectedQuote.status} />
            <DetailField label="Sent At" value={selectedQuote.sentAt} />
            <DetailField label="Valid Until" value={selectedQuote.validUntil} />
            <DetailField label="Assigned Rep" value={selectedQuote.assignedRep} />
            <DetailField label="Close Probability" value={`${selectedQuote.probability}%`} />
          </div>
        </DetailModal>
      ) : null}
    </DashboardShell>
  );
}
