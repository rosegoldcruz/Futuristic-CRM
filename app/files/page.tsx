// TODO: reconnect to Postgres/Supabase when backend is available.
"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { FileText, Image, File, Archive } from "lucide-react";

const MOCK_FILES = [
  { id: "F-001", name: "emma-castillo-contract.pdf", type: "contract", jobId: "VK-2041", size: "142 KB", uploadedAt: "2025-05-02" },
  { id: "F-002", name: "james-park-qc-before.jpg", type: "photo", jobId: "VK-2038", size: "3.2 MB", uploadedAt: "2025-05-06" },
  { id: "F-003", name: "james-park-qc-after.jpg", type: "photo", jobId: "VK-2038", size: "2.9 MB", uploadedAt: "2025-05-07" },
  { id: "F-004", name: "tony-nguyen-quote-v2.pdf", type: "document", jobId: "VK-2044", size: "88 KB", uploadedAt: "2025-05-05" },
  { id: "F-005", name: "permit-AZ48821-alvarez.pdf", type: "permit", jobId: "VK-2050", size: "210 KB", uploadedAt: "2025-05-03" },
  { id: "F-006", name: "supplier-manifest-az-cab.xlsx", type: "document", jobId: "—", size: "54 KB", uploadedAt: "2025-05-04" },
  { id: "F-007", name: "wilson-qc-photos.zip", type: "archive", jobId: "VK-2033", size: "18.4 MB", uploadedAt: "2025-05-06" },
  { id: "F-008", name: "rachel-kim-vanity-contract.pdf", type: "contract", jobId: "VK-2029", size: "136 KB", uploadedAt: "2025-05-05" },
];

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  contract: FileText,
  photo: Image,
  document: File,
  permit: FileText,
  archive: Archive,
};

const TYPE_COLORS: Record<string, string> = {
  contract: "text-cyber-cyan",
  photo: "text-cyber-magenta",
  document: "text-cyber-yellow",
  permit: "text-cyber-yellow",
  archive: "text-textSecondary",
};

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

export default function FilesPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const filtered = useMemo(() => {
    return MOCK_FILES.filter((f) => {
      const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.jobId.toLowerCase().includes(search.toLowerCase());
      const matchType = !typeFilter || f.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [search, typeFilter]);

  const photoCount = MOCK_FILES.filter((f) => f.type === "photo").length;
  const contractCount = MOCK_FILES.filter((f) => f.type === "contract").length;
  const docCount = MOCK_FILES.filter((f) => f.type === "document" || f.type === "permit").length;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-cyber-cyan" style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}>
            Files
          </h1>
          <p className="text-sm text-textSecondary font-mono">// Internal file library for project assets and uploads</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total Files" value={MOCK_FILES.length} variant="cyan" />
          <KpiCard label="Photos" value={photoCount} variant="magenta" />
          <KpiCard label="Contracts" value={contractCount} variant="green" />
          <KpiCard label="Documents" value={docCount} variant="yellow" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search filename or job ID..."
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
            <option value="contract">Contracts</option>
            <option value="photo">Photos</option>
            <option value="document">Documents</option>
            <option value="permit">Permits</option>
            <option value="archive">Archives</option>
          </select>
          <span className="text-xs text-textMuted font-mono">{filtered.length} / {MOCK_FILES.length} files</span>
        </div>

        <section className="cyber-card-tw border-l-4 border-l-cyber-cyan shadow-cyberInset overflow-x-auto p-0">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-borderSubtle bg-bgDark">
                {["ID", "File Name", "Type", "Linked Job", "Size", "Uploaded"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-display text-[10px] uppercase tracking-[0.15em] text-cyber-cyan/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => {
                const Icon = TYPE_ICONS[f.type] || File;
                return (
                  <tr key={f.id} className="border-b border-borderSubtle hover:bg-surface/60 transition-colors">
                    <td className="px-4 py-3 font-mono text-textMuted">{f.id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${TYPE_COLORS[f.type]}`} />
                        <span className="font-medium text-textPrimary">{f.name}</span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-wider ${TYPE_COLORS[f.type]}`}>{f.type}</td>
                    <td className="px-4 py-3 font-mono text-cyber-cyan">{f.jobId}</td>
                    <td className="px-4 py-3 text-textMuted font-mono">{f.size}</td>
                    <td className="px-4 py-3 text-textMuted font-mono">{f.uploadedAt}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </DashboardShell>
  );
}
