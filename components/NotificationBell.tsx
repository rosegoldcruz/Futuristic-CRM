"use client"

import { useEffect, useState } from "react"
import { Bell, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"

type Notification = {
  id: number
  title: string
  message: string
  notification_type: string
  is_read: boolean
  created_at: string
  action_url?: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

type NotificationBellProps = {
  homeowner_id?: number
  onNotificationClick?: (notification: Notification) => void
}

export default function NotificationBell({ homeowner_id = 1, onNotificationClick }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadNotifications()
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [homeowner_id])

  async function loadNotifications() {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/portal/notifications/${homeowner_id}?limit=20`, {
        cache: "no-store",
      })
      if (res.ok) {
        const data = await res.json()
        setNotifications(data)
        setUnreadCount(data.filter((n: Notification) => !n.is_read).length)
      }
    } catch (err) {
      console.error("Failed to load notifications:", err)
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(notificationIds: number[]) {
    try {
      const res = await fetch(`${API_BASE}/portal/notifications/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: notificationIds }),
      })
      if (res.ok) {
        await loadNotifications()
      }
    } catch (err) {
      console.error("Failed to mark as read:", err)
    }
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length > 0) {
      await markAsRead(unreadIds)
    }
  }

  function handleNotificationClick(notification: Notification) {
    if (!notification.is_read) {
      markAsRead([notification.id])
    }
    if (onNotificationClick) {
      onNotificationClick(notification)
    }
    if (notification.action_url) {
      window.location.href = notification.action_url
    }
  }

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-neutral-800 transition"
      >
        <Bell className="w-5 h-5 text-neutral-400" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Notification Panel */}
          <div className="absolute right-0 top-12 w-96 max-h-[600px] bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-800">
              <h3 className="font-semibold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Mark all read
                </Button>
              )}
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto flex-1">
              {loading && (
                <div className="p-8 text-center">
                  <p className="text-neutral-500 text-sm">Loading...</p>
                </div>
              )}

              {!loading && notifications.length === 0 && (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
                  <p className="text-neutral-500 text-sm">No notifications yet</p>
                </div>
              )}

              {!loading && notifications.length > 0 && (
                <div className="divide-y divide-neutral-800">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 cursor-pointer hover:bg-neutral-800/50 transition ${
                        !notification.is_read ? "bg-blue-950/10" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-1">
                            <h4 className={`text-sm font-medium ${
                              !notification.is_read ? "text-white" : "text-neutral-300"
                            }`}>
                              {notification.title}
                            </h4>
                            {!notification.is_read && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full mt-1" />
                            )}
                          </div>
                          <p className="text-xs text-neutral-400 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-neutral-600 mt-2">
                            {new Date(notification.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-neutral-800">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-neutral-400"
                  onClick={() => {
                    window.location.href = "/portal/homeowner"
                    setIsOpen(false)
                  }}
                >
                  View All Notifications
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
