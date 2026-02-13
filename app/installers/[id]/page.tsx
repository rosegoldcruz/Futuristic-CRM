"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"

type InstallerStatus = "pending" | "active" | "inactive" | "suspended" | "terminated"
type InstallerTier = "apprentice" | "standard" | "pro" | "elite"

type Installer = {
  id: number
  tenant_id?: number | null
  first_name: string
  last_name: string
  email?: string | null
  phone: string
  phone_secondary?: string | null
  company_name?: string | null
  status: InstallerStatus | null
  tier: InstallerTier | null
  skills?: string[] | null
  service_area_zips?: string[] | null
  service_radius_miles?: number | null
  max_jobs_per_day?: number | null
  max_jobs_per_week?: number | null
  base_hourly_rate?: number | null
  base_job_rate?: number | null
  has_insurance?: boolean | null
  has_vehicle?: boolean | null
  has_tools?: boolean | null
  jobs_completed?: number | null
  jobs_cancelled?: number | null
  rating_average?: number | null
  rating_count?: number | null
  total_earnings?: number | null
  pending_payout?: number | null
  internal_notes?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type Job = {
  id: number
  customer_name: string
  status: string | null
  scheduled_date?: string | null
  created_at?: string | null
}

type Availability = {
  installer_id: number
  available: boolean
  current_jobs_today: number
  current_jobs_week: number
  max_jobs_per_day: number
  max_jobs_per_week: number
  message: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50",
  active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  inactive: "bg-neutral-500/20 text-neutral-300 border-neutral-500/50",
  suspended: "bg-red-500/20 text-red-300 border-red-500/50",
  terminated: "bg-red-900/20 text-red-400 border-red-900/50",
}

const TIER_COLORS: Record<string, string> = {
  apprentice: "bg-slate-600/30 text-slate-300",
  standard: "bg-blue-600/30 text-blue-300",
  pro: "bg-purple-600/30 text-purple-300",
  elite: "bg-amber-600/30 text-amber-300",
}

const JOB_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-300",
  scheduled: "bg-purple-500/20 text-purple-300",
  in_progress: "bg-amber-500/20 text-amber-300",
  completed: "bg-emerald-500/20 text-emerald-300",
  cancelled: "bg-red-500/20 text-red-300",
}

export default function InstallerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const installerId = params.id as string

  const [installer, setInstaller] = useState<Installer | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchInstaller() {
    try {
      const res = await fetch(`${API_BASE}/installers/${installerId}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`Failed to load installer (${res.status})`)
      const data: Installer = await res.json()
      setInstaller(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load installer"
      setError(message)
    }
  }

  async function fetchJobs() {
    try {
      const res = await fetch(`${API_BASE}/installers/${installerId}/jobs?limit=20`, { cache: "no-store" })
      if (!res.ok) return
      const data: Job[] = await res.json()
      setJobs(data)
    } catch (err: unknown) {
      console.error("Failed to load jobs:", err)
    }
  }

  async function fetchAvailability() {
    try {
      const res = await fetch(`${API_BASE}/installers/${installerId}/availability`, { cache: "no-store" })
      if (!res.ok) return
      const data: Availability = await res.json()
      setAvailability(data)
    } catch (err: unknown) {
      console.error("Failed to load availability:", err)
    }
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      await Promise.all([fetchInstaller(), fetchJobs(), fetchAvailability()])
      setLoading(false)
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installerId])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-neutral-400">Loading installer details…</div>
      </div>
    )
  }

  if (!installer) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <div className="text-red-400">{error || "Installer not found"}</div>
        <Link
          href="/installers"
          className="rounded-md bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700"
        >
          ← Back to Installers
        </Link>
      </div>
    )
  }

  const fullName = `${installer.first_name} ${installer.last_name}`

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Link href="/installers" className="text-sm text-neutral-400 hover:text-white">
              ← Installers
            </Link>
            <span className="text-neutral-600">/</span>
            <span className="text-sm text-neutral-300">#{installer.id}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-emerald-400 text-xl font-semibold text-black">
              {installer.first_name?.[0]}{installer.last_name?.[0]}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">{fullName}</h1>
              {installer.company_name && (
                <p className="text-sm text-neutral-400">{installer.company_name}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${
              STATUS_COLORS[installer.status || "pending"] || "bg-neutral-800"
            }`}
          >
            {installer.status || "pending"}
          </span>
          <span
            className={`inline-block rounded px-3 py-1 text-sm font-medium capitalize ${
              TIER_COLORS[installer.tier || "apprentice"] || "bg-neutral-800"
            }`}
          >
            {installer.tier || "apprentice"}
          </span>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-red-800 bg-red-950 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Contact Information
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-neutral-500">Phone</p>
                <p className="text-sm text-white">{installer.phone}</p>
              </div>
              {installer.phone_secondary && (
                <div>
                  <p className="text-xs text-neutral-500">Secondary Phone</p>
                  <p className="text-sm text-white">{installer.phone_secondary}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-neutral-500">Email</p>
                <p className="text-sm text-white">{installer.email || "—"}</p>
              </div>
            </div>
          </div>

          {/* Skills & Service Area */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Skills & Service Area
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-neutral-500 mb-2">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {installer.skills && installer.skills.length > 0 ? (
                    installer.skills.map((skill: string) => (
                      <span
                        key={skill}
                        className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
                      >
                        {skill.replace(/_/g, " ")}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-neutral-500">No skills listed</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-2">Service Area ZIPs</p>
                <div className="flex flex-wrap gap-2">
                  {installer.service_area_zips && installer.service_area_zips.length > 0 ? (
                    installer.service_area_zips.map((zip: string) => (
                      <span
                        key={zip}
                        className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
                      >
                        {zip}
                      </span>
                    ))
                  ) : installer.service_radius_miles ? (
                    <span className="text-sm text-neutral-400">
                      {installer.service_radius_miles} mile radius
                    </span>
                  ) : (
                    <span className="text-sm text-neutral-500">No service area defined</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Assigned Jobs */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Assigned Jobs ({jobs.length})
            </h2>
            {jobs.length === 0 ? (
              <p className="text-sm text-neutral-500">No jobs assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900/50 px-4 py-3 hover:bg-neutral-800/50"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">
                        #{job.id} — {job.customer_name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {job.scheduled_date
                          ? new Date(job.scheduled_date).toLocaleDateString()
                          : "Not scheduled"}
                      </p>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-xs capitalize ${
                        JOB_STATUS_COLORS[job.status || "pending"] || "bg-neutral-800"
                      }`}
                    >
                      {job.status || "pending"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Availability Card */}
          <div
            className={`rounded-lg border p-5 ${
              availability?.available
                ? "border-emerald-900/50 bg-emerald-950/20"
                : "border-amber-900/50 bg-amber-950/20"
            }`}
          >
            <h2
              className={`mb-4 text-sm font-semibold uppercase tracking-wider ${
                availability?.available ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              Availability
            </h2>
            {availability ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-3 w-3 rounded-full ${
                      availability.available ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                  />
                  <span className="text-sm text-white">
                    {availability.available ? "Available" : "At Capacity"}
                  </span>
                </div>
                <p className="text-xs text-neutral-400">{availability.message}</p>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded bg-neutral-900/50 p-2 text-center">
                    <p className="text-lg font-semibold text-white">
                      {availability.current_jobs_today}/{availability.max_jobs_per_day}
                    </p>
                    <p className="text-[10px] text-neutral-500">Today</p>
                  </div>
                  <div className="rounded bg-neutral-900/50 p-2 text-center">
                    <p className="text-lg font-semibold text-white">
                      {availability.current_jobs_week}/{availability.max_jobs_per_week}
                    </p>
                    <p className="text-[10px] text-neutral-500">This Week</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Loading availability…</p>
            )}
          </div>

          {/* Stats Card */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Performance
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-neutral-400">Jobs Completed</span>
                <span className="text-sm font-medium text-emerald-400">
                  {installer.jobs_completed || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-400">Jobs Cancelled</span>
                <span className="text-sm font-medium text-red-400">
                  {installer.jobs_cancelled || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-400">Rating</span>
                <span className="text-sm font-medium text-amber-400">
                  ★ {installer.rating_average?.toFixed(1) || "—"} ({installer.rating_count || 0})
                </span>
              </div>
              {installer.total_earnings !== null && installer.total_earnings !== undefined && (
                <div className="flex justify-between">
                  <span className="text-sm text-neutral-400">Total Earnings</span>
                  <span className="text-sm font-medium text-white">
                    ${installer.total_earnings.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Capabilities Card */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Capabilities
            </h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    installer.has_insurance ? "bg-emerald-400" : "bg-neutral-600"
                  }`}
                />
                <span className="text-sm text-neutral-300">Insurance</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    installer.has_vehicle ? "bg-emerald-400" : "bg-neutral-600"
                  }`}
                />
                <span className="text-sm text-neutral-300">Vehicle</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    installer.has_tools ? "bg-emerald-400" : "bg-neutral-600"
                  }`}
                />
                <span className="text-sm text-neutral-300">Tools</span>
              </div>
            </div>
          </div>

          {/* Rates Card */}
          {(installer.base_hourly_rate || installer.base_job_rate) && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
                Rates
              </h2>
              <div className="space-y-2">
                {installer.base_hourly_rate && (
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-400">Hourly Rate</span>
                    <span className="text-sm font-medium text-white">
                      ${installer.base_hourly_rate}/hr
                    </span>
                  </div>
                )}
                {installer.base_job_rate && (
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-400">Job Rate</span>
                    <span className="text-sm font-medium text-white">
                      ${installer.base_job_rate}/job
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Quick Actions
            </h2>
            <div className="space-y-2">
              <button
                onClick={() => router.push("/installers")}
                className="w-full rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
              >
                ← Back to Installers
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
