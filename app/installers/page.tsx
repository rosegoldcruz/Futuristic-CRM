"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type InstallerStatus = "pending" | "active" | "inactive" | "suspended" | "terminated"
type InstallerTier = "apprentice" | "standard" | "pro" | "elite"

type Installer = {
  id: number
  tenant_id?: number | null
  first_name: string
  last_name: string
  full_name?: string | null
  email?: string | null
  phone: string
  phone_secondary?: string | null
  company_name?: string | null
  status: InstallerStatus
  tier: InstallerTier
  skills?: string[] | null
  service_area_zips?: string[] | null
  service_radius_miles?: number | null
  max_jobs_per_day?: number | null
  max_jobs_per_week?: number | null
  base_hourly_rate?: number | null
  base_job_rate?: number | null
  has_insurance: boolean
  has_vehicle: boolean
  has_tools: boolean
  jobs_completed: number
  jobs_cancelled: number
  rating_average?: number | null
  rating_count: number
  total_earnings?: number | null
  pending_payout?: number | null
  internal_notes?: string | null
  created_at?: string | null
  updated_at?: string | null
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

const STATUS_COLORS: Record<InstallerStatus, string> = {
  pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50",
  active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  inactive: "bg-neutral-500/20 text-neutral-300 border-neutral-500/50",
  suspended: "bg-red-500/20 text-red-300 border-red-500/50",
  terminated: "bg-red-900/20 text-red-400 border-red-900/50",
}

const TIER_COLORS: Record<InstallerTier, string> = {
  apprentice: "bg-slate-600/30 text-slate-300",
  standard: "bg-blue-600/30 text-blue-300",
  pro: "bg-purple-600/30 text-purple-300",
  elite: "bg-amber-600/30 text-amber-300",
}

export default function InstallersPage() {
  const [installers, setInstallers] = useState<Installer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<InstallerStatus | "">("")
  const [tierFilter, setTierFilter] = useState<InstallerTier | "">("")

  async function fetchInstallers() {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (search.trim()) params.set("search", search.trim())
      if (statusFilter) params.set("status", statusFilter)
      if (tierFilter) params.set("tier", tierFilter)

      const res = await fetch(`${API_BASE}/installers/?${params.toString()}`, {
        cache: "no-store",
      })

      if (!res.ok) throw new Error(`Failed to load installers (${res.status})`)

      const data: Installer[] = await res.json()
      setInstallers(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load installers"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInstallers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function formatRating(rating: number | null | undefined): string {
    if (rating === null || rating === undefined) return "—"
    return rating.toFixed(1)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Installer Network
          </h1>
          <p className="text-sm text-neutral-400">
            Manage your verified labor pool — cabinet refacing, installation, and more.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search installers..."
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InstallerStatus | "")}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="terminated">Terminated</option>
          </select>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as InstallerTier | "")}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All tiers</option>
            <option value="apprentice">Apprentice</option>
            <option value="standard">Standard</option>
            <option value="pro">Pro</option>
            <option value="elite">Elite</option>
          </select>
          <button
            onClick={fetchInstallers}
            className="rounded-md bg-neutral-800 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700"
          >
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-red-800 bg-red-950 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Installers</p>
          <p className="mt-1 text-2xl font-semibold text-white">{installers.length}</p>
        </div>
        <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Active</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-300">
            {installers.filter((i) => i.status === "active").length}
          </p>
        </div>
        <div className="rounded-lg border border-yellow-900/50 bg-yellow-950/30 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-yellow-400">Pending</p>
          <p className="mt-1 text-2xl font-semibold text-yellow-300">
            {installers.filter((i) => i.status === "pending").length}
          </p>
        </div>
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-400">Avg Rating</p>
          <p className="mt-1 text-2xl font-semibold text-amber-300">
            {installers.length > 0
              ? (
                  installers
                    .filter((i) => i.rating_average !== null && i.rating_average !== undefined)
                    .reduce((sum, i) => sum + (i.rating_average || 0), 0) /
                  Math.max(1, installers.filter((i) => i.rating_average !== null).length)
                ).toFixed(1)
              : "—"}
          </p>
        </div>
      </div>

      {/* Installers Table */}
      <section className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950">
        <table className="min-w-full text-left text-sm text-neutral-200">
          <thead className="bg-neutral-900 text-xs uppercase text-neutral-400">
            <tr>
              <th className="px-4 py-3">Installer</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Skills</th>
              <th className="px-4 py-3">Service Areas</th>
              <th className="px-4 py-3">Jobs</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-neutral-400">
                  Loading installers…
                </td>
              </tr>
            ) : installers.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-neutral-500">
                  No installers found.
                </td>
              </tr>
            ) : (
              installers.map((installer) => (
                <tr
                  key={installer.id}
                  className="border-t border-neutral-800 hover:bg-neutral-900/60"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-emerald-400 text-sm font-semibold text-black">
                        {installer.first_name?.[0]}{installer.last_name?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          {installer.full_name || `${installer.first_name} ${installer.last_name}`}
                        </p>
                        {installer.company_name && (
                          <p className="text-xs text-neutral-500">{installer.company_name}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm">{installer.phone}</p>
                    {installer.email && (
                      <p className="text-xs text-neutral-500">{installer.email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-xs capitalize ${
                        STATUS_COLORS[installer.status] || "bg-neutral-800"
                      }`}
                    >
                      {installer.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs capitalize ${
                        TIER_COLORS[installer.tier] || "bg-neutral-800"
                      }`}
                    >
                      {installer.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {installer.skills && installer.skills.length > 0 ? (
                        installer.skills.slice(0, 2).map((skill: string) => (
                          <span
                            key={skill}
                            className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300"
                          >
                            {skill.replace(/_/g, " ")}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-neutral-500">—</span>
                      )}
                      {installer.skills && installer.skills.length > 2 && (
                        <span className="text-[10px] text-neutral-500">
                          +{installer.skills.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {installer.service_area_zips && installer.service_area_zips.length > 0 ? (
                        <>
                          {installer.service_area_zips.slice(0, 2).map((zip) => (
                            <span
                              key={zip}
                              className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300"
                            >
                              {zip}
                            </span>
                          ))}
                          {installer.service_area_zips.length > 2 && (
                            <span className="text-[10px] text-neutral-500">
                              +{installer.service_area_zips.length - 2}
                            </span>
                          )}
                        </>
                      ) : installer.service_radius_miles ? (
                        <span className="text-xs text-neutral-400">
                          {installer.service_radius_miles} mi radius
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-500">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <span className="text-emerald-400">{installer.jobs_completed}</span>
                      <span className="text-neutral-600"> / </span>
                      <span className="text-red-400">{installer.jobs_cancelled}</span>
                    </div>
                    <p className="text-[10px] text-neutral-500">completed / cancelled</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-amber-400">★</span>
                      <span className="text-sm font-medium">
                        {formatRating(installer.rating_average)}
                      </span>
                      <span className="text-xs text-neutral-500">
                        ({installer.rating_count})
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/installers/${installer.id}`}
                      className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
