"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Calendar, CheckCircle, Clock, FileText, Package } from "lucide-react"

type Job = {
  id: number
  customer_name: string
  status: string
  scheduled_date?: string | null
  scheduled_time_start?: string | null
  project_details?: any
}

type WorkOrder = {
  id: number
  job_id: number
  customer_name: string
  status: string
  scheduled_date?: string | null
  materials_snapshot?: any[]
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

// Mock installer ID - In production, get from Clerk auth context
const INSTALLER_ID = 1

export default function InstallerPortalPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
  })

  useEffect(() => {
    loadInstallerData()
  }, [])

  async function loadInstallerData() {
    try {
      setLoading(true)

      // Fetch jobs assigned to this installer
      const jobsRes = await fetch(`${API_BASE}/jobs/?installer_id=${INSTALLER_ID}&limit=100`, {
        cache: "no-store",
      })
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json()
        setJobs(jobsData)

        // Calculate stats
        const total = jobsData.length
        const pending = jobsData.filter((j: Job) => j.status === "pending").length
        const inProgress = jobsData.filter((j: Job) => j.status === "in_progress").length
        const completed = jobsData.filter((j: Job) => j.status === "completed").length

        setStats({ total, pending, inProgress, completed })
      }

      // Fetch work orders for this installer
      const woRes = await fetch(
        `${API_BASE}/work-orders/?installer_id=${INSTALLER_ID}&limit=100`,
        { cache: "no-store" }
      )
      if (woRes.ok) {
        const woData = await woRes.json()
        setWorkOrders(woData)
      }
    } catch (err) {
      console.error("Failed to load installer data:", err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-neutral-400">Loading your portal...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Installer Portal</h1>
          <p className="text-sm text-neutral-400">Your jobs and work orders</p>
        </div>
        <Link
          href="/"
          className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
        >
          ← Back to Dashboard
        </Link>
      </header>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-amber-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-neutral-400">Total Jobs</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.pending}</p>
              <p className="text-xs text-neutral-400">Pending</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 text-blue-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.inProgress}</p>
              <p className="text-xs text-neutral-400">In Progress</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.completed}</p>
              <p className="text-xs text-neutral-400">Completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Jobs */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="mb-4 text-lg font-semibold text-white">Your Active Jobs</h2>
        {jobs.length > 0 ? (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="block rounded-md border border-slate-700 bg-slate-800/50 p-4 transition hover:bg-slate-800"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-white">{job.customer_name}</h3>
                    <p className="text-sm text-neutral-400">Job #{job.id}</p>
                    {job.scheduled_date && (
                      <p className="mt-2 text-xs text-neutral-500">
                        Scheduled: {new Date(job.scheduled_date).toLocaleDateString()}
                        {job.scheduled_time_start && ` at ${job.scheduled_time_start}`}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      job.status === "completed"
                        ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                        : job.status === "in_progress"
                        ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                        : "border-slate-500/50 bg-slate-500/20 text-slate-300"
                    }`}
                  >
                    {job.status?.replace(/_/g, " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No active jobs assigned</p>
        )}
      </div>

      {/* Work Orders */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="mb-4 text-lg font-semibold text-white">Your Work Orders</h2>
        {workOrders.length > 0 ? (
          <div className="space-y-3">
            {workOrders.map((wo) => (
              <Link
                key={wo.id}
                href={`/work-orders/${wo.id}`}
                className="block rounded-md border border-slate-700 bg-slate-800/50 p-4 transition hover:bg-slate-800"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-amber-400" />
                      <h3 className="font-medium text-white">WO #{wo.id}</h3>
                    </div>
                    <p className="text-sm text-neutral-400">{wo.customer_name}</p>
                    {wo.scheduled_date && (
                      <p className="mt-2 text-xs text-neutral-500">
                        {new Date(wo.scheduled_date).toLocaleDateString()}
                      </p>
                    )}
                    {wo.materials_snapshot && wo.materials_snapshot.length > 0 && (
                      <p className="mt-1 text-xs text-neutral-500">
                        {wo.materials_snapshot.length} material{wo.materials_snapshot.length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      wo.status === "completed"
                        ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                        : wo.status === "in_progress"
                        ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                        : "border-slate-500/50 bg-slate-500/20 text-slate-300"
                    }`}
                  >
                    {wo.status?.replace(/_/g, " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No work orders assigned</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber-400">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/installers"
            className="rounded-md border border-amber-700 bg-amber-900/30 px-4 py-2 text-sm text-amber-200 hover:bg-amber-900/50"
          >
            View My Profile
          </Link>
          <button className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800">
            Download Documents
          </button>
        </div>
      </div>
    </div>
  )
}
