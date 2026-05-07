// TODO: reconnect to Postgres/Supabase when backend is available.
// Currently using local mock data so the UI works as a portfolio-ready MVP.
"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { mockJobs } from "@/app/lib/mockData";
import type { Job } from "@/app/lib/mockData";
import { DetailField, DetailModal } from "@/components/ui/detail-modal";
import { formatStatusLabel } from "@/app/lib/format";

const MATERIAL_COLORS: Record<Job["materialStatus"], string> = {
  ordered: "bg-cyber-cyan/10 border-cyber-cyan/50 text-cyber-cyan",
  "in-transit": "bg-cyber-yellow/10 border-cyber-yellow/50 text-cyber-yellow",
  delivered: "bg-cyber-green/10 border-cyber-green/50 text-cyber-green",
  missing: "bg-cyber-red/10 border-cyber-red/50 text-cyber-red",
  delayed: "bg-cyber-red/10 border-cyber-red/50 text-cyber-red",
};

const PAYMENT_COLORS: Record<Job["paymentStatus"], string> = {
  paid: "bg-cyber-green/10 border-cyber-green/50 text-cyber-green",
  partial: "bg-cyber-yellow/10 border-cyber-yellow/50 text-cyber-yellow",
  hold: "bg-cyber-red/10 border-cyber-red/50 text-cyber-red",
  pending: "bg-cyber-cyan/10 border-cyber-cyan/50 text-cyber-cyan",
  overdue: "bg-cyber-red/10 border-cyber-red/50 text-cyber-red",
};

const QC_COLORS: Record<Job["qcStatus"], string> = {
  pending: "bg-textMuted/20 border-textMuted/50 text-textMuted",
  passed: "bg-cyber-green/10 border-cyber-green/50 text-cyber-green",
  failed: "bg-cyber-red/10 border-cyber-red/50 text-cyber-red",
  "photos-due": "bg-cyber-yellow/10 border-cyber-yellow/50 text-cyber-yellow",
};

const STAGE_COLORS: Record<Job["stage"], string> = {
  scheduled: "bg-cyber-cyan/10 border-cyber-cyan/50 text-cyber-cyan",
  "in-progress": "bg-cyber-green/10 border-cyber-green/50 text-cyber-green",
  "awaiting-installer": "bg-cyber-yellow/10 border-cyber-yellow/50 text-cyber-yellow",
  completed: "bg-cyber-green/10 border-cyber-green/50 text-cyber-green",
  "on-hold": "bg-cyber-red/10 border-cyber-red/50 text-cyber-red",
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      {label.replace("-", " ")}
    </span>
  );
}

function KpiCard({ label, value, variant = "cyan" }: { label: string; value: string | number; variant?: "cyan" | "magenta" | "yellow" | "green" | "red" }) {
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
      <p className={`mt-2 text-2xl font-bold font-display ${c.text}`} style={{ textShadow: `0 0 15px ${c.glow}` }}>{value}</p>
    </div>
  );
}

export default function JobsPage() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const jobs = mockJobs;

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      const matchSearch =
        !search ||
        j.customerName.toLowerCase().includes(search.toLowerCase()) ||
        j.city.toLowerCase().includes(search.toLowerCase()) ||
        j.id.toLowerCase().includes(search.toLowerCase());
      const matchStage = !stageFilter || j.stage === stageFilter;
      return matchSearch && matchStage;
    });
  }, [jobs, search, stageFilter]);

  const activeCount = jobs.filter((j) => j.stage !== "completed").length;
  const awaitingInstaller = jobs.filter((j) => j.stage === "awaiting-installer").length;
  const materialDelays = jobs.filter((j) => j.materialStatus === "delayed" || j.materialStatus === "missing").length;
  const paymentHolds = jobs.filter((j) => j.paymentStatus === "hold" || j.paymentStatus === "overdue").length;

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1
            className="font-display text-3xl font-bold uppercase tracking-wider text-cyber-cyan"
            style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}
          >
            Jobs
          </h1>
          <p className="text-sm text-textSecondary font-mono">
            // Active install and fulfillment pipeline
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Active Jobs" value={activeCount} variant="cyan" />
          <KpiCard label="Awaiting Installer" value={awaitingInstaller} variant="yellow" />
          <KpiCard label="Material Delays" value={materialDelays} variant="red" />
          <KpiCard label="Payment Holds" value={paymentHolds} variant="red" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search job ID, customer, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 border border-borderSubtle bg-surface px-3 py-2 text-xs text-textPrimary placeholder-textMuted focus:border-cyber-cyan/60 focus:outline-none font-mono"
          />
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="border border-borderSubtle bg-surface px-3 py-2 text-xs text-textPrimary focus:border-cyber-cyan/60 focus:outline-none font-mono"
          >
            <option value="">All Stages</option>
            <option value="scheduled">Scheduled</option>
            <option value="in-progress">In Progress</option>
            <option value="awaiting-installer">Awaiting Installer</option>
            <option value="on-hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
          <span className="text-xs text-textMuted font-mono">{filtered.length} / {jobs.length} records</span>
        </div>

        {/* Table */}
        <section className="cyber-card-tw border-l-4 border-l-cyber-cyan shadow-cyberInset overflow-x-auto p-0">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-borderSubtle bg-bgDark">
                {["Job ID", "Customer", "City", "Project", "Installer", "Supplier", "Materials", "Payment", "QC", "Stage", "Install Date", "Next Action"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-display text-[10px] uppercase tracking-[0.15em] text-cyber-cyan/70 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-textMuted font-mono">// No jobs match filter</td>
                </tr>
              ) : (
                filtered.map((job) => (
                  <tr
                    key={job.id}
                    className={`cursor-pointer border-b border-borderSubtle transition-colors hover:bg-surface/60 ${
                      job.stage === "on-hold" || job.paymentStatus === "hold" || job.materialStatus === "missing"
                        ? "bg-cyber-red/5"
                        : ""
                    }`}
                    onClick={() => setSelectedJob(job)}
                  >
                    <td className="px-4 py-3 font-mono text-cyber-cyan font-bold">{job.id}</td>
                    <td className="px-4 py-3 font-medium text-textPrimary whitespace-nowrap">{job.customerName}</td>
                    <td className="px-4 py-3 text-textSecondary">{job.city}</td>
                    <td className="px-4 py-3 text-textSecondary whitespace-nowrap">{job.projectType}</td>
                    <td className="px-4 py-3 text-textSecondary whitespace-nowrap">{job.installer}</td>
                    <td className="px-4 py-3 text-textSecondary whitespace-nowrap">{job.supplier}</td>
                    <td className="px-4 py-3"><Badge label={job.materialStatus} colorClass={MATERIAL_COLORS[job.materialStatus]} /></td>
                    <td className="px-4 py-3"><Badge label={job.paymentStatus} colorClass={PAYMENT_COLORS[job.paymentStatus]} /></td>
                    <td className="px-4 py-3"><Badge label={job.qcStatus} colorClass={QC_COLORS[job.qcStatus]} /></td>
                    <td className="px-4 py-3"><Badge label={job.stage} colorClass={STAGE_COLORS[job.stage]} /></td>
                    <td className="px-4 py-3 text-textMuted font-mono whitespace-nowrap">{job.installDate}</td>
                    <td className="px-4 py-3 text-textSecondary whitespace-nowrap max-w-[180px] truncate" title={job.nextAction}>{job.nextAction}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
      {selectedJob ? (
        <DetailModal
          title={`Job Card — ${selectedJob.id}`}
          subtitle={`${selectedJob.customerName} • ${selectedJob.projectType}`}
          onClose={() => setSelectedJob(null)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Customer" value={selectedJob.customerName} />
            <DetailField label="City" value={selectedJob.city} />
            <DetailField label="Project Type" value={selectedJob.projectType} />
            <DetailField label="Install Date" value={selectedJob.installDate} />
            <DetailField label="Installer" value={selectedJob.installer} />
            <DetailField label="Supplier" value={selectedJob.supplier} />
            <DetailField label="Material Status" value={formatStatusLabel(selectedJob.materialStatus)} />
            <DetailField label="Payment Status" value={formatStatusLabel(selectedJob.paymentStatus)} />
            <DetailField label="QC Status" value={formatStatusLabel(selectedJob.qcStatus)} />
            <DetailField label="Stage" value={formatStatusLabel(selectedJob.stage)} />
          </div>
          <div className="mt-3 border border-borderSubtle/80 bg-surface/40 px-3 py-2">
            <p className="text-[10px] font-display font-bold uppercase tracking-[0.15em] text-cyber-cyan/70">Next Action</p>
            <p className="mt-1 text-sm text-textPrimary">{selectedJob.nextAction}</p>
          </div>
        </DetailModal>
      ) : null}
    </DashboardShell>
  );
}
