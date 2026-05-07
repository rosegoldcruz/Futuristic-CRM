// TODO: reconnect to Postgres/Supabase when backend is available.
"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { mockPayments } from "@/app/lib/mockData";
import type { Payment } from "@/app/lib/mockData";

const STATUS_COLORS: Record<Payment["status"], string> = {
  paid: "bg-cyber-green/10 border-cyber-green/50 text-cyber-green",
  pending: "bg-cyber-cyan/10 border-cyber-cyan/50 text-cyber-cyan",
  hold: "bg-cyber-red/10 border-cyber-red/50 text-cyber-red",
  overdue: "bg-cyber-red/10 border-cyber-red/50 text-cyber-red",
  partial: "bg-cyber-yellow/10 border-cyber-yellow/50 text-cyber-yellow",
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      {label}
    </span>
  );
}

function KpiCard({ label, value, variant = "cyan" }: { label: string; value: string | number; variant?: "cyan" | "green" | "yellow" | "red" }) {
  const colors = {
    cyan: { border: "border-cyber-cyan/30", text: "text-cyber-cyan", glow: "rgba(0,240,255,0.5)" },
    green: { border: "border-cyber-green/30", text: "text-cyber-green", glow: "rgba(0,255,102,0.5)" },
    yellow: { border: "border-cyber-yellow/30", text: "text-cyber-yellow", glow: "rgba(255,230,0,0.5)" },
    red: { border: "border-cyber-red/30", text: "text-cyber-red", glow: "rgba(255,0,68,0.5)" },
  };
  const c = colors[variant];
  return (
    <div className={`cyber-card-tw ${c.border} shadow-cyberInset`}>
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-textMuted">// {label}</p>
      <p className={`mt-2 text-2xl font-bold font-display ${c.text}`} style={{ textShadow: `0 0 15px ${c.glow}` }}>{value}</p>
    </div>
  );
}

export default function PaymentsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const payments = mockPayments;

  const filtered = useMemo(() => {
    if (!statusFilter) return payments;
    return payments.filter((p) => p.status === statusFilter);
  }, [payments, statusFilter]);

  const paidAmount = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const pendingCount = payments.filter((p) => p.status === "pending" || p.status === "partial").length;
  const holdCount = payments.filter((p) => p.status === "hold" || p.status === "overdue").length;
  const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-cyber-cyan" style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}>
            Payments
          </h1>
          <p className="text-sm text-textSecondary font-mono">// Deposits, balances, holds, invoices, and payouts</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Collected" value={`$${(paidAmount / 1000).toFixed(0)}K`} variant="green" />
          <KpiCard label="Pending / Partial" value={pendingCount} variant="yellow" />
          <KpiCard label="Holds / Overdue" value={holdCount} variant="red" />
          <KpiCard label="Total Pipeline" value={`$${(totalRevenue / 1000).toFixed(0)}K`} variant="cyan" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-borderSubtle bg-surface px-3 py-2 text-xs text-textPrimary focus:border-cyber-cyan/60 focus:outline-none font-mono"
          >
            <option value="">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="hold">Hold</option>
            <option value="overdue">Overdue</option>
          </select>
          <span className="text-xs text-textMuted font-mono">{filtered.length} / {payments.length} invoices</span>
        </div>

        <section className="cyber-card-tw border-l-4 border-l-cyber-cyan shadow-cyberInset overflow-x-auto p-0">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-borderSubtle bg-bgDark">
                {["Invoice ID", "Customer", "Amount", "Status", "Due Date"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-display text-[10px] uppercase tracking-[0.15em] text-cyber-cyan/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.invoiceId} className={`border-b border-borderSubtle hover:bg-surface/60 transition-colors ${p.status === "hold" || p.status === "overdue" ? "bg-cyber-red/5" : ""}`}>
                  <td className="px-4 py-3 font-mono text-cyber-cyan font-bold">{p.invoiceId}</td>
                  <td className="px-4 py-3 font-medium text-textPrimary">{p.customerName}</td>
                  <td className="px-4 py-3 font-mono font-bold text-cyber-green">${p.amount.toLocaleString()}</td>
                  <td className="px-4 py-3"><Badge label={p.status} colorClass={STATUS_COLORS[p.status]} /></td>
                  <td className="px-4 py-3 text-textMuted font-mono">{p.dueDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </DashboardShell>
  );
}
