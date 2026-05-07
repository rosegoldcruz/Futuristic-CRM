// TODO: reconnect to Postgres/Supabase when backend is available.
"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { mockDocuments } from "@/app/lib/mockData";
import type { Document } from "@/app/lib/mockData";

const STATUS_COLORS: Record<Document["status"], string> = {
  signed: "bg-cyber-green/10 border-cyber-green/50 text-cyber-green",
  pending: "bg-cyber-yellow/10 border-cyber-yellow/50 text-cyber-yellow",
  draft: "bg-textMuted/20 border-textMuted/50 text-textMuted",
  expired: "bg-cyber-red/10 border-cyber-red/50 text-cyber-red",
};

const TYPE_COLORS: Record<Document["type"], string> = {
  contract: "text-cyber-cyan",
  quote: "text-cyber-yellow",
  "qc-photo": "text-cyber-magenta",
  completion: "text-cyber-green",
  permit: "text-cyber-yellow",
  invoice: "text-cyber-green",
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      {label}
    </span>
  );
}

function KpiCard({ label, value, variant = "cyan" }: { label: string; value: string | number; variant?: "cyan" | "green" | "yellow" | "magenta" }) {
  const colors = {
    cyan: { border: "border-cyber-cyan/30", text: "text-cyber-cyan", glow: "rgba(0,240,255,0.5)" },
    green: { border: "border-cyber-green/30", text: "text-cyber-green", glow: "rgba(0,255,102,0.5)" },
    yellow: { border: "border-cyber-yellow/30", text: "text-cyber-yellow", glow: "rgba(255,230,0,0.5)" },
    magenta: { border: "border-cyber-magenta/30", text: "text-cyber-magenta", glow: "rgba(255,0,255,0.5)" },
  };
  const c = colors[variant];
  return (
    <div className={`cyber-card-tw ${c.border} shadow-cyberInset`}>
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-textMuted">// {label}</p>
      <p className={`mt-2 text-2xl font-bold font-display ${c.text}`} style={{ textShadow: `0 0 15px ${c.glow}` }}>{value}</p>
    </div>
  );
}

export default function DocumentsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const documents = mockDocuments;

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.linkedJob.toLowerCase().includes(search.toLowerCase());
      const matchType = !typeFilter || d.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [documents, search, typeFilter]);

  const signedCount = documents.filter((d) => d.status === "signed").length;
  const pendingCount = documents.filter((d) => d.status === "pending").length;
  const draftCount = documents.filter((d) => d.status === "draft").length;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-cyber-cyan" style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}>
            Documents
          </h1>
          <p className="text-sm text-textSecondary font-mono">// Quotes, contracts, QC photos, and completion records</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total Documents" value={documents.length} variant="cyan" />
          <KpiCard label="Signed" value={signedCount} variant="green" />
          <KpiCard label="Pending Signature" value={pendingCount} variant="yellow" />
          <KpiCard label="Drafts" value={draftCount} variant="magenta" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search document name or job ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 border border-borderSubtle bg-surface px-3 py-2 text-xs text-textPrimary placeholder-textMuted focus:border-cyber-cyan/60 focus:outline-none font-mono"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-borderSubtle bg-surface px-3 py-2 text-xs text-textPrimary focus:border-cyber-cyan/60 focus:outline-none font-mono"
          >
            <option value="">All Types</option>
            <option value="contract">Contract</option>
            <option value="quote">Quote</option>
            <option value="qc-photo">QC Photo</option>
            <option value="completion">Completion</option>
            <option value="permit">Permit</option>
            <option value="invoice">Invoice</option>
          </select>
          <span className="text-xs text-textMuted font-mono">{filtered.length} / {documents.length} records</span>
        </div>

        <section className="cyber-card-tw border-l-4 border-l-cyber-cyan shadow-cyberInset overflow-x-auto p-0">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-borderSubtle bg-bgDark">
                {["ID", "Document Name", "Type", "Linked Job", "Status", "Uploaded"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-display text-[10px] uppercase tracking-[0.15em] text-cyber-cyan/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id} className="border-b border-borderSubtle hover:bg-surface/60 transition-colors">
                  <td className="px-4 py-3 font-mono text-textMuted">{doc.id}</td>
                  <td className="px-4 py-3 font-medium text-textPrimary">{doc.name}</td>
                  <td className={`px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-wider ${TYPE_COLORS[doc.type]}`}>{doc.type.replace("-", " ")}</td>
                  <td className="px-4 py-3 font-mono text-cyber-cyan">{doc.linkedJob}</td>
                  <td className="px-4 py-3"><Badge label={doc.status} colorClass={STATUS_COLORS[doc.status]} /></td>
                  <td className="px-4 py-3 text-textMuted font-mono">{doc.uploadedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </DashboardShell>
  );
}
