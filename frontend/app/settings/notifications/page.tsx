"use client"

import { useEffect, useState } from "react"
import { Bell, Mail, MessageSquare, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"

type Preference = {
  id: number
  user_id: number
  user_type: string
  channel: string
  notification_type: string
  is_enabled: boolean
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

// Mock user - in production, get from auth context
const USER_ID = 1
const USER_TYPE = "homeowner"

const CHANNEL_ICONS: Record<string, any> = {
  email: Mail,
  sms: Smartphone,
  in_app: Bell,
  push: Bell,
}

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  sms: "SMS/Text",
  in_app: "In-App",
  push: "Push Notifications",
}

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  quote_ready: "Quote Ready",
  quote_approved: "Quote Approved",
  payment_received: "Payment Received",
  job_scheduled: "Job Scheduled",
  job_completed: "Job Completed",
  document_ready: "Document Ready",
  signature_required: "Signature Required",
  message_received: "Message Received",
  system_alert: "System Alert",
}

export default function NotificationPreferencesPage() {
  const [preferences, setPreferences] = useState<Preference[]>([])
  const [channels, setChannels] = useState<string[]>([])
  const [notificationTypes, setNotificationTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)

      // Load available channels
      const channelsRes = await fetch(`${API_BASE}/notifications/channels`)
      if (channelsRes.ok) {
        const channelsData = await channelsRes.json()
        setChannels(channelsData)
      }

      // Load notification types
      const typesRes = await fetch(`${API_BASE}/notifications/types`)
      if (typesRes.ok) {
        const typesData = await typesRes.json()
        setNotificationTypes(typesData)
      }

      // Load user preferences
      const prefsRes = await fetch(
        `${API_BASE}/notifications/preferences/${USER_ID}/${USER_TYPE}`
      )
      if (prefsRes.ok) {
        const prefsData = await prefsRes.json()
        setPreferences(prefsData)
      }
    } catch (err) {
      console.error("Failed to load preferences:", err)
    } finally {
      setLoading(false)
    }
  }

  async function togglePreference(channel: string, notificationType: string, currentValue: boolean) {
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/notifications/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: USER_ID,
          user_type: USER_TYPE,
          channel,
          notification_type: notificationType,
          is_enabled: !currentValue,
        }),
      })

      if (res.ok) {
        await loadData()
      }
    } catch (err) {
      console.error("Failed to update preference:", err)
    } finally {
      setSaving(false)
    }
  }

  function getPreferenceValue(channel: string, notificationType: string): boolean {
    const pref = preferences.find(
      (p) => p.channel === channel && p.notification_type === notificationType
    )
    return pref ? pref.is_enabled : true // Default to enabled
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-neutral-400">Loading preferences...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-semibold text-white">Notification Preferences</h1>
        <p className="text-sm text-neutral-400">
          Choose how you want to receive notifications
        </p>
      </header>

      {/* Channel Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        {channels.map((channel) => {
          const Icon = CHANNEL_ICONS[channel] || Bell
          return (
            <div
              key={channel}
              className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <Icon className="w-5 h-5 text-blue-400" />
                <h3 className="font-medium text-white">
                  {CHANNEL_LABELS[channel] || channel}
                </h3>
              </div>
              <p className="text-xs text-neutral-500">
                {channel === "email" && "Notifications sent to your email"}
                {channel === "sms" && "Text messages to your phone"}
                {channel === "in_app" && "Alerts in the portal"}
                {channel === "push" && "Browser push notifications"}
              </p>
            </div>
          )
        })}
      </div>

      {/* Preference Matrix */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left p-4 text-sm font-medium text-neutral-400">
                  Notification Type
                </th>
                {channels.map((channel) => (
                  <th key={channel} className="p-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      {(() => {
                        const Icon = CHANNEL_ICONS[channel] || Bell
                        return <Icon className="w-4 h-4 text-neutral-400" />
                      })()}
                      <span className="text-xs text-neutral-400">
                        {CHANNEL_LABELS[channel] || channel}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notificationTypes.map((type, idx) => (
                <tr
                  key={type}
                  className={idx !== notificationTypes.length - 1 ? "border-b border-neutral-800" : ""}
                >
                  <td className="p-4">
                    <p className="text-sm font-medium text-white">
                      {NOTIFICATION_TYPE_LABELS[type] || type}
                    </p>
                  </td>
                  {channels.map((channel) => {
                    const isEnabled = getPreferenceValue(channel, type)
                    return (
                      <td key={channel} className="p-4 text-center">
                        <button
                          onClick={() =>
                            togglePreference(channel, type, isEnabled)
                          }
                          disabled={saving}
                          className={`w-10 h-6 rounded-full transition relative ${
                            isEnabled
                              ? "bg-blue-600"
                              : "bg-neutral-700"
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition ${
                              isEnabled ? "right-1" : "left-1"
                            }`}
                          />
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box */}
      <div className="rounded-lg border border-blue-900/50 bg-blue-950/20 p-4">
        <p className="text-sm text-neutral-300">
          <strong className="text-blue-300">Note:</strong> Email and SMS notifications
          may have additional delivery charges. In-app notifications are always free.
        </p>
      </div>
    </div>
  )
}
