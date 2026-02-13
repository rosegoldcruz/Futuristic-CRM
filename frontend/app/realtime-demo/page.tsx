"use client"

import { useEffect } from "react"
import {
  useRealtimeJobs,
  useRealtimeQuotes,
  useRealtimeWorkOrders,
  useRealtimePayments,
  useRealtimeEntity,
} from "@/hooks/useRealtimeEntities"
import { useDashboardPresence } from "@/hooks/usePresence"
import {
  LiveIndicator,
  ConnectionStatus,
  OnlineUsers,
} from "@/components/LiveIndicator"
import { Briefcase, FileText, Wrench, DollarSign, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function RealtimeDemoPage() {
  const { jobs, lastUpdate: jobsUpdate, setJobs } = useRealtimeJobs()
  const { quotes, lastUpdate: quotesUpdate, setQuotes } = useRealtimeQuotes()
  const { workOrders, lastUpdate: woUpdate, setWorkOrders } = useRealtimeWorkOrders()
  const { payments, lastUpdate: paymentsUpdate, setPayments } = useRealtimePayments()

  // Presence tracking
  const { onlineUsers, isTracking } = useDashboardPresence("1", "Demo User")

  // Optimistic updates example
  const {
    data: files,
    optimisticUpdate,
    optimisticCreate,
    isUpdating,
  } = useRealtimeEntity("files", [])

  useEffect(() => {
    // Initialize with mock data
    setJobs([
      { id: 1, homeowner_id: 1, status: "scheduled", created_at: new Date().toISOString() },
      { id: 2, homeowner_id: 2, status: "in_progress", created_at: new Date().toISOString() },
    ])

    setQuotes([
      { id: 1, homeowner_id: 1, status: "pending", total_price: 25000, created_at: new Date().toISOString() },
      { id: 2, homeowner_id: 2, status: "approved", total_price: 30000, created_at: new Date().toISOString() },
    ])

    setWorkOrders([
      { id: 1, job_id: 1, status: "pending", created_at: new Date().toISOString() },
    ])

    setPayments([
      { id: 1, job_id: 1, amount: 7500, status: "completed", created_at: new Date().toISOString() },
    ])
  }, [setJobs, setQuotes, setWorkOrders, setPayments])

  function simulateUpdate() {
    // Simulate a real-time update
    setJobs((prev) =>
      prev.map((job) =>
        job.id === 1 ? { ...job, status: "in_progress", updated_at: new Date().toISOString() } : job
      )
    )
  }

  function simulateCreate() {
    const newJob = {
      id: Date.now(),
      homeowner_id: 3,
      status: "scheduled",
      created_at: new Date().toISOString(),
    }
    setJobs((prev) => [newJob, ...prev])
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-blue-400" />
            Real-Time Dashboard
          </h1>
          <p className="text-sm text-neutral-400">Live updates • No refresh needed</p>
        </div>
        <div className="flex items-center gap-4">
          {isTracking && <OnlineUsers count={onlineUsers.length} />}
          <ConnectionStatus />
        </div>
      </header>

      {/* Demo Controls */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h3 className="text-sm font-medium text-white mb-3">Demo Controls</h3>
        <div className="flex gap-2">
          <Button onClick={simulateUpdate} size="sm" variant="outline">
            Simulate Job Update
          </Button>
          <Button onClick={simulateCreate} size="sm" variant="outline">
            Simulate Job Create
          </Button>
        </div>
      </div>

      {/* Real-Time Entities Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Jobs */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-400" />
              <h3 className="font-medium text-white">Jobs</h3>
            </div>
            <LiveIndicator lastUpdate={jobsUpdate} showTimestamp />
          </div>
          <div className="space-y-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="p-2 rounded bg-neutral-950 border border-neutral-800"
              >
                <p className="text-sm text-white">Job #{job.id}</p>
                <p className="text-xs text-neutral-500 capitalize">{job.status}</p>
              </div>
            ))}
            {jobs.length === 0 && (
              <p className="text-sm text-neutral-500 text-center py-4">No jobs</p>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-800">
            <p className="text-xs text-neutral-500">
              Total: <span className="text-white font-semibold">{jobs.length}</span>
            </p>
          </div>
        </div>

        {/* Quotes */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              <h3 className="font-medium text-white">Quotes</h3>
            </div>
            <LiveIndicator lastUpdate={quotesUpdate} showTimestamp />
          </div>
          <div className="space-y-2">
            {quotes.map((quote) => (
              <div
                key={quote.id}
                className="p-2 rounded bg-neutral-950 border border-neutral-800"
              >
                <p className="text-sm text-white">Quote #{quote.id}</p>
                <p className="text-xs text-neutral-500 capitalize">{quote.status}</p>
                <p className="text-xs text-emerald-400">${quote.total_price?.toLocaleString()}</p>
              </div>
            ))}
            {quotes.length === 0 && (
              <p className="text-sm text-neutral-500 text-center py-4">No quotes</p>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-800">
            <p className="text-xs text-neutral-500">
              Total: <span className="text-white font-semibold">{quotes.length}</span>
            </p>
          </div>
        </div>

        {/* Work Orders */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-400" />
              <h3 className="font-medium text-white">Work Orders</h3>
            </div>
            <LiveIndicator lastUpdate={woUpdate} showTimestamp />
          </div>
          <div className="space-y-2">
            {workOrders.map((wo) => (
              <div
                key={wo.id}
                className="p-2 rounded bg-neutral-950 border border-neutral-800"
              >
                <p className="text-sm text-white">WO #{wo.id}</p>
                <p className="text-xs text-neutral-500 capitalize">{wo.status}</p>
              </div>
            ))}
            {workOrders.length === 0 && (
              <p className="text-sm text-neutral-500 text-center py-4">No work orders</p>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-800">
            <p className="text-xs text-neutral-500">
              Total: <span className="text-white font-semibold">{workOrders.length}</span>
            </p>
          </div>
        </div>

        {/* Payments */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-purple-400" />
              <h3 className="font-medium text-white">Payments</h3>
            </div>
            <LiveIndicator lastUpdate={paymentsUpdate} showTimestamp />
          </div>
          <div className="space-y-2">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="p-2 rounded bg-neutral-950 border border-neutral-800"
              >
                <p className="text-sm text-white">${payment.amount?.toLocaleString()}</p>
                <p className="text-xs text-neutral-500 capitalize">{payment.status}</p>
              </div>
            ))}
            {payments.length === 0 && (
              <p className="text-sm text-neutral-500 text-center py-4">No payments</p>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-800">
            <p className="text-xs text-neutral-500">
              Total: <span className="text-white font-semibold">{payments.length}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Presence Info */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h3 className="text-sm font-medium text-white mb-3">Online Users</h3>
        <div className="space-y-2">
          {onlineUsers.map((user) => (
            <div
              key={user.user_id}
              className="flex items-center gap-3 p-2 rounded bg-neutral-950"
            >
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-xs text-white font-medium">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm text-white">{user.username}</p>
                <p className="text-xs text-neutral-500">
                  Online since {new Date(user.online_at).toLocaleTimeString()}
                </p>
              </div>
              <div className="ml-auto">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              </div>
            </div>
          ))}
          {onlineUsers.length === 0 && (
            <p className="text-sm text-neutral-500 text-center py-4">No users online</p>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="rounded-lg border border-blue-900/50 bg-blue-950/20 p-4">
        <p className="text-sm text-neutral-300">
          <strong className="text-blue-300">Real-Time Enabled:</strong> This dashboard updates
          instantly when data changes. No page refresh needed! Try the demo controls above to see
          live updates in action.
        </p>
      </div>
    </div>
  )
}
