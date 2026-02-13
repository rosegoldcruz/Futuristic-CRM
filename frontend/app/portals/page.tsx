"use client"

import Link from "next/link"
import { Users, Home, Shield } from "lucide-react"

export default function PortalsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">AEON Portals</h1>
        <p className="text-sm text-neutral-400">
          Access role-specific portals with filtered data
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Installer Portal */}
        <Link
          href="/portal/installer"
          className="group relative overflow-hidden rounded-lg border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6 transition hover:border-amber-500/50"
        >
          <div className="relative z-10">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/20">
              <Users className="h-6 w-6 text-amber-400" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-white">Installer Portal</h2>
            <p className="text-sm text-neutral-400">
              View your assigned jobs, work orders, and project documents
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm text-amber-400">
              <span>Access Portal</span>
              <span>→</span>
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-amber-500/5 opacity-0 transition group-hover:opacity-100"></div>
        </Link>

        {/* Homeowner Portal */}
        <Link
          href="/portal/homeowner"
          className="group relative overflow-hidden rounded-lg border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6 transition hover:border-emerald-500/50"
        >
          <div className="relative z-10">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/20">
              <Home className="h-6 w-6 text-emerald-400" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-white">Homeowner Portal</h2>
            <p className="text-sm text-neutral-400">
              Review quotes, track jobs, and view your project documents
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm text-emerald-400">
              <span>Access Portal</span>
              <span>→</span>
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/5 opacity-0 transition group-hover:opacity-100"></div>
        </Link>

        {/* Admin Portal */}
        <Link
          href="/portal/admin"
          className="group relative overflow-hidden rounded-lg border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6 transition hover:border-blue-500/50"
        >
          <div className="relative z-10">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/20">
              <Shield className="h-6 w-6 text-blue-400" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-white">Admin Portal</h2>
            <p className="text-sm text-neutral-400">
              System-wide overview with full access to all data and operations
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm text-blue-400">
              <span>Access Portal</span>
              <span>→</span>
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/5 opacity-0 transition group-hover:opacity-100"></div>
        </Link>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Portal Features
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <h3 className="mb-2 font-medium text-white">Role-Based Access</h3>
            <p className="text-sm text-neutral-400">
              Each portal shows only relevant data based on user role and permissions
            </p>
          </div>
          <div>
            <h3 className="mb-2 font-medium text-white">Data Isolation</h3>
            <p className="text-sm text-neutral-400">
              Installers see only their jobs, homeowners see only their quotes
            </p>
          </div>
          <div>
            <h3 className="mb-2 font-medium text-white">Secure Sessions</h3>
            <p className="text-sm text-neutral-400">
              All portals enforce authentication and tenant-level isolation
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber-400">
          Authentication Notice
        </h2>
        <p className="text-sm text-neutral-300">
          In production, portal access is controlled by{" "}
          <strong>Clerk authentication</strong>. Users are automatically routed to
          their appropriate portal based on their role and organization membership.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Current mode: Development (Mock authentication with full access)
        </p>
      </div>
    </div>
  )
}
