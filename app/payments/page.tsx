"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, Eye, DollarSign, TrendingUp, Clock, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

type Payment = {
  id: number
  job_id?: number | null
  installer_id?: number | null
  job_customer_name?: string | null
  installer_name?: string | null
  payment_type: string
  payment_method?: string | null
  amount: number
  status: string
  paid_at?: string | null
  description?: string | null
  reference_number?: string | null
  created_at?: string | null
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50",
  processing: "bg-blue-500/20 text-blue-300 border-blue-500/50",
  completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  failed: "bg-red-600/20 text-red-400 border-red-600/50",
  refunded: "bg-purple-500/20 text-purple-300 border-purple-500/50",
  cancelled: "bg-slate-500/20 text-slate-300 border-slate-500/50",
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [typeFilter, setTypeFilter] = useState<string>("")

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    totalAmount: 0,
  })

  async function loadPayments() {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      if (typeFilter) params.set("payment_type", typeFilter)
      params.set("limit", "100")

      const res = await fetch(`${API_BASE}/payments/?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`Failed to load payments (${res.status})`)
      const data: Payment[] = await res.json()
      setPayments(data)

      // Calculate stats
      const total = data.length
      const pending = data.filter((p) => p.status === "pending").length
      const completed = data.filter((p) => p.status === "completed").length
      const totalAmount = data
        .filter((p) => p.status === "completed")
        .reduce((sum, p) => sum + p.amount, 0)

      setStats({ total, pending, completed, totalAmount })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load payments"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Payments</h1>
          <p className="text-sm text-neutral-400">Track deposits, invoices, and transactions</p>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-emerald-400" />
            <div>
              <p className="text-2xl font-bold text-white">
                ${stats.totalAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-xs text-neutral-400">Total Completed</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-blue-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-neutral-400">Total Payments</p>
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
            <CheckCircle className="h-8 w-8 text-emerald-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.completed}</p>
              <p className="text-xs text-neutral-400">Completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full md:w-48 rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-full md:w-48 rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
        >
          <option value="">All types</option>
          <option value="deposit">Deposit</option>
          <option value="payment">Payment</option>
          <option value="refund">Refund</option>
          <option value="adjustment">Adjustment</option>
        </select>

        <Button
          variant="outline"
          size="sm"
          onClick={loadPayments}
          disabled={loading}
          className="border-neutral-700 text-neutral-200 hover:bg-neutral-800 md:ml-auto"
        >
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-neutral-800 bg-neutral-950/70">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900/80 border-b border-neutral-800 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">ID</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Job/Customer</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Type</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Method</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-400">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Status</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">Date</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-neutral-500 text-sm">
                  No payments yet
                </td>
              </tr>
            )}

            {payments.map((payment) => (
              <tr
                key={payment.id}
                className="border-t border-neutral-900 hover:bg-neutral-900/60 transition-colors"
              >
                <td className="px-4 py-3 text-neutral-300 font-medium">#{payment.id}</td>
                <td className="px-4 py-3">
                  {payment.job_id ? (
                    <div>
                      <Link href={`/jobs/${payment.job_id}`} className="text-amber-400 hover:underline">
                        Job #{payment.job_id}
                      </Link>
                      {payment.job_customer_name && (
                        <p className="text-xs text-neutral-500">{payment.job_customer_name}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-neutral-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="capitalize text-neutral-300">{payment.payment_type}</span>
                </td>
                <td className="px-4 py-3 text-neutral-400 capitalize">
                  {payment.payment_method?.replace(/_/g, " ") || "—"}
                </td>
                <td className="px-4 py-3 text-right font-medium text-white">
                  ${payment.amount.toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
                      STATUS_COLORS[payment.status] || STATUS_COLORS.pending
                    }`}
                  >
                    {payment.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-300">
                  {payment.paid_at
                    ? new Date(payment.paid_at).toLocaleDateString()
                    : payment.created_at
                    ? new Date(payment.created_at).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/payments/${payment.id}`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-amber-400 hover:text-amber-200 hover:bg-amber-950/60"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}

            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-neutral-500 text-sm">
                  Loading payments…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
