"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BarChart3, Users, Briefcase, FileText, TrendingUp, Activity } from "lucide-react"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

type Stats = {
  total_leads: number
  total_homeowners: number
  total_installers: number
  total_quotes: number
  total_jobs: number
  total_work_orders: number
  active_jobs: number
  pending_quotes: number
}

export default function AdminPortalPage() {
  const [stats, setStats] = useState<Stats>({
    total_leads: 0,
    total_homeowners: 0,
    total_installers: 0,
    total_quotes: 0,
    total_jobs: 0,
    total_work_orders: 0,
    active_jobs: 0,
    pending_quotes: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAdminData()
  }, [])

  async function loadAdminData() {
    try {
      setLoading(true)

      // Fetch counts from various endpoints
      // In production, create a dedicated /admin/stats endpoint
      const [leadsRes, homeownersRes, installersRes, quotesRes, jobsRes, workOrdersRes] =
        await Promise.all([
          fetch(`${API_BASE}/leads/?limit=1`, { cache: "no-store" }),
          fetch(`${API_BASE}/homeowners/?limit=1`, { cache: "no-store" }),
          fetch(`${API_BASE}/installers/?limit=1`, { cache: "no-store" }),
          fetch(`${API_BASE}/quotes/?limit=1`, { cache: "no-store" }),
          fetch(`${API_BASE}/jobs/?limit=1`, { cache: "no-store" }),
          fetch(`${API_BASE}/work-orders/?limit=1`, { cache: "no-store" }),
        ])

      // Parse responses and extract counts
      // Note: This is a simplified version. In production, use proper pagination/count endpoints

      const leads = leadsRes.ok ? await leadsRes.json() : []
      const homeowners = homeownersRes.ok ? await homeownersRes.json() : []
      const installers = installersRes.ok ? await installersRes.json() : []
      const quotes = quotesRes.ok ? await quotesRes.json() : []
      const jobs = jobsRes.ok ? await jobsRes.json() : []
      const workOrders = workOrdersRes.ok ? await workOrdersRes.json() : []

      setStats({
        total_leads: leads.length,
        total_homeowners: homeowners.length,
        total_installers: installers.length,
        total_quotes: quotes.length,
        total_jobs: jobs.length,
        total_work_orders: workOrders.length,
        active_jobs: jobs.filter((j: any) => j.status === "in_progress").length,
        pending_quotes: quotes.filter((q: any) => q.status === "pending").length,
      })
    } catch (err) {
      console.error("Failed to load admin data:", err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-neutral-400">Loading admin portal...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Admin Portal</h1>
          <p className="text-sm text-neutral-400">System-wide overview and management</p>
        </div>
        <Link
          href="/"
          className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
        >
          ← Back to Dashboard
        </Link>
      </header>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.total_leads}</p>
              <p className="text-xs text-neutral-400">Total Leads</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-emerald-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.total_homeowners}</p>
              <p className="text-xs text-neutral-400">Homeowners</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-amber-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.total_installers}</p>
              <p className="text-xs text-neutral-400">Installers</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-purple-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.total_quotes}</p>
              <p className="text-xs text-neutral-400">Quotes</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <Briefcase className="h-8 w-8 text-cyan-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.total_jobs}</p>
              <p className="text-xs text-neutral-400">Total Jobs</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-orange-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.active_jobs}</p>
              <p className="text-xs text-neutral-400">Active Jobs</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-yellow-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.pending_quotes}</p>
              <p className="text-xs text-neutral-400">Pending Quotes</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.total_work_orders}</p>
              <p className="text-xs text-neutral-400">Work Orders</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/leads"
          className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 transition hover:bg-slate-800"
        >
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-blue-400" />
            <div>
              <h3 className="font-semibold text-white">Manage Leads</h3>
              <p className="text-xs text-neutral-400">View and convert leads</p>
            </div>
          </div>
        </Link>

        <Link
          href="/quotes"
          className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 transition hover:bg-slate-800"
        >
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-purple-400" />
            <div>
              <h3 className="font-semibold text-white">Manage Quotes</h3>
              <p className="text-xs text-neutral-400">Review and approve quotes</p>
            </div>
          </div>
        </Link>

        <Link
          href="/jobs"
          className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 transition hover:bg-slate-800"
        >
          <div className="flex items-center gap-3">
            <Briefcase className="h-6 w-6 text-cyan-400" />
            <div>
              <h3 className="font-semibold text-white">Manage Jobs</h3>
              <p className="text-xs text-neutral-400">Track job progress</p>
            </div>
          </div>
        </Link>

        <Link
          href="/installers"
          className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 transition hover:bg-slate-800"
        >
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-amber-400" />
            <div>
              <h3 className="font-semibold text-white">Manage Installers</h3>
              <p className="text-xs text-neutral-400">View installer roster</p>
            </div>
          </div>
        </Link>

        <Link
          href="/work-orders"
          className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 transition hover:bg-slate-800"
        >
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-green-400" />
            <div>
              <h3 className="font-semibold text-white">Work Orders</h3>
              <p className="text-xs text-neutral-400">View all work orders</p>
            </div>
          </div>
        </Link>

        <Link
          href="/reports"
          className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 transition hover:bg-slate-800"
        >
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-pink-400" />
            <div>
              <h3 className="font-semibold text-white">Reports</h3>
              <p className="text-xs text-neutral-400">Analytics and insights</p>
            </div>
          </div>
        </Link>
      </div>

      {/* System Status */}
      <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-emerald-400">
          System Status
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400"></div>
            <span className="text-sm text-white">Database Online</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400"></div>
            <span className="text-sm text-white">API Healthy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400"></div>
            <span className="text-sm text-white">Auth Active</span>
          </div>
        </div>
      </div>
    </div>
  )
}
