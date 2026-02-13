"use client"

import { useEffect, useState } from "react"
import {
  FileText,
  DollarSign,
  Calendar,
  Bell,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"

type TimelineItem = {
  id: number
  event_type: string
  title: string
  description?: string
  status?: string
  created_at: string
}

type Message = {
  id: number
  sender_name: string
  sender_type: string
  message_text: string
  is_read: boolean
  created_at: string
}

type Notification = {
  id: number
  title: string
  message: string
  notification_type: string
  is_read: boolean
  created_at: string
}

type Dashboard = {
  job?: any
  quote?: any
  work_order?: any
  payments: any[]
  documents: any[]
  timeline: TimelineItem[]
  messages: Message[]
  notifications: Notification[]
  unread_messages_count: number
  unread_notifications_count: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

// Mock homeowner ID for preview mode
const HOMEOWNER_ID = 1

export default function HomeownerPortalPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"timeline" | "payments" | "documents" | "messages">("timeline")
  const [newMessage, setNewMessage] = useState("")

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/portal/dashboard/${HOMEOWNER_ID}`, {
        cache: "no-store",
      })
      if (res.ok) {
        const data = await res.json()
        setDashboard(data)
      }
    } catch (err) {
      console.error("Failed to load dashboard:", err)
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !dashboard?.job) return
    
    try {
      const res = await fetch(`${API_BASE}/portal/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: dashboard.job.id,
          message_text: newMessage,
          sender_name: "Homeowner",
        }),
      })
      if (res.ok) {
        setNewMessage("")
        await loadDashboard()
      }
    } catch (err) {
      console.error("Failed to send message:", err)
    }
  }

  async function markNotificationsRead() {
    if (!dashboard?.notifications) return
    const unreadIds = dashboard.notifications.filter(n => !n.is_read).map(n => n.id)
    if (unreadIds.length === 0) return
    
    try {
      await fetch(`${API_BASE}/portal/notifications/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds }),
      })
      await loadDashboard()
    } catch (err) {
      console.error("Failed to mark notifications read:", err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-neutral-400">Loading your portal...</p>
      </div>
    )
  }

  if (!dashboard?.job) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="w-12 h-12 text-neutral-500 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">No Active Project</h2>
        <p className="text-neutral-400">You don't have any active solar projects yet.</p>
      </div>
    )
  }

  const totalPaid = dashboard.payments
    .filter((p: any) => p.status === "completed")
    .reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-semibold text-white">My Solar Project</h1>
        <p className="text-sm text-neutral-400">Job #{dashboard.job.id}</p>
      </header>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-blue-400" />
            <p className="text-xs text-neutral-400">Quote Status</p>
          </div>
          <p className="text-xl font-bold text-white capitalize">
            {dashboard.quote?.status || "Pending"}
          </p>
          {dashboard.quote && (
            <p className="text-xs text-neutral-500 mt-1">
              ${parseFloat(dashboard.quote.total_price || 0).toLocaleString()}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-neutral-400">Payments</p>
          </div>
          <p className="text-xl font-bold text-white">${totalPaid.toLocaleString()}</p>
          <p className="text-xs text-neutral-500 mt-1">
            {dashboard.payments.length} payment{dashboard.payments.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 relative">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-4 h-4 text-purple-400" />
            <p className="text-xs text-neutral-400">Messages</p>
          </div>
          <p className="text-xl font-bold text-white">{dashboard.messages.length}</p>
          {dashboard.unread_messages_count > 0 && (
            <span className="absolute top-2 right-2 bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
              {dashboard.unread_messages_count}
            </span>
          )}
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 relative">
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-4 h-4 text-amber-400" />
            <p className="text-xs text-neutral-400">Notifications</p>
          </div>
          <p className="text-xl font-bold text-white">{dashboard.notifications.length}</p>
          {dashboard.unread_notifications_count > 0 && (
            <span className="absolute top-2 right-2 bg-amber-600 text-white text-xs px-2 py-0.5 rounded-full">
              {dashboard.unread_notifications_count}
            </span>
          )}
        </div>
      </div>

      {/* Notifications Banner */}
      {dashboard.unread_notifications_count > 0 && (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-amber-400" />
              <div>
                <p className="font-medium text-white">You have {dashboard.unread_notifications_count} new notification{dashboard.unread_notifications_count !== 1 ? "s" : ""}</p>
                <p className="text-sm text-neutral-400">Click to view and dismiss</p>
              </div>
            </div>
            <Button onClick={markNotificationsRead} variant="outline" size="sm">
              Mark All Read
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-neutral-800">
        <button
          onClick={() => setActiveTab("timeline")}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === "timeline"
              ? "border-b-2 border-blue-500 text-white"
              : "text-neutral-400 hover:text-neutral-300"
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          Timeline
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === "payments"
              ? "border-b-2 border-blue-500 text-white"
              : "text-neutral-400 hover:text-neutral-300"
          }`}
        >
          <DollarSign className="w-4 h-4 inline mr-2" />
          Payments
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === "documents"
              ? "border-b-2 border-blue-500 text-white"
              : "text-neutral-400 hover:text-neutral-300"
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Documents
        </button>
        <button
          onClick={() => setActiveTab("messages")}
          className={`px-4 py-2 text-sm font-medium transition relative ${
            activeTab === "messages"
              ? "border-b-2 border-blue-500 text-white"
              : "text-neutral-400 hover:text-neutral-300"
          }`}
        >
          <MessageSquare className="w-4 h-4 inline mr-2" />
          Messages
          {dashboard.unread_messages_count > 0 && (
            <span className="ml-2 bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
              {dashboard.unread_messages_count}
            </span>
          )}
        </button>
      </div>

      {/* Timeline Tab */}
      {activeTab === "timeline" && (
        <div className="space-y-4">
          {dashboard.timeline.map((item: TimelineItem, idx: number) => (
            <div key={item.id} className="relative pl-8">
              {idx !== dashboard.timeline.length - 1 && (
                <div className="absolute left-3 top-8 bottom-0 w-0.5 bg-neutral-800" />
              )}
              <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-neutral-900 border-2 border-blue-500 flex items-center justify-center">
                {item.event_type === "quote" && <FileText className="w-3 h-3 text-blue-400" />}
                {item.event_type === "payment" && <DollarSign className="w-3 h-3 text-emerald-400" />}
                {item.event_type === "work_order" && <Clock className="w-3 h-3 text-amber-400" />}
                {item.event_type === "document" && <FileText className="w-3 h-3 text-purple-400" />}
              </div>
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-white">{item.title}</h3>
                    {item.description && (
                      <p className="text-sm text-neutral-400 mt-1">{item.description}</p>
                    )}
                    <p className="text-xs text-neutral-500 mt-2">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                  {item.status && (
                    <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/50 capitalize">
                      {item.status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {dashboard.timeline.length === 0 && (
            <p className="text-center text-neutral-500 py-8">No timeline events yet</p>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          {dashboard.payments.map((payment: any) => (
            <div key={payment.id} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-white capitalize">
                    {payment.payment_type} Payment
                  </h3>
                  <p className="text-sm text-neutral-400 mt-1">
                    {new Date(payment.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-emerald-400">
                    ${parseFloat(payment.amount).toLocaleString()}
                  </p>
                  <span className={`text-xs px-2 py-1 rounded mt-1 inline-block ${
                    payment.status === "completed"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                  }`}>
                    {payment.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {dashboard.payments.length === 0 && (
            <p className="text-center text-neutral-500 py-8">No payments yet</p>
          )}
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === "documents" && (
        <div className="grid gap-4 md:grid-cols-2">
          {dashboard.documents.map((doc: any) => (
            <div key={doc.id} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="flex items-start gap-3">
                <FileText className="w-8 h-8 text-blue-400 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-medium text-white capitalize">
                    {doc.document_type?.replace(/_/g, " ")}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                  <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/50 mt-2 inline-block capitalize">
                    {doc.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {dashboard.documents.length === 0 && (
            <p className="col-span-2 text-center text-neutral-500 py-8">No documents yet</p>
          )}
        </div>
      )}

      {/* Messages Tab */}
      {activeTab === "messages" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type your message..."
                className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-white placeholder:text-neutral-500"
              />
              <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                Send
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            {dashboard.messages.map((msg: Message) => (
              <div key={msg.id} className={`rounded-lg border border-neutral-800 p-4 ${
                msg.sender_type === "homeowner"
                  ? "bg-blue-950/20 ml-8"
                  : "bg-neutral-900/50 mr-8"
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium text-white">{msg.sender_name}</p>
                  <p className="text-xs text-neutral-500">
                    {new Date(msg.created_at).toLocaleString()}
                  </p>
                </div>
                <p className="text-sm text-neutral-300">{msg.message_text}</p>
              </div>
            ))}
            {dashboard.messages.length === 0 && (
              <p className="text-center text-neutral-500 py-8">No messages yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
