/**
 * usePresence - Track online users in real-time
 */
import { useEffect, useState } from "react"
import { supabaseRealtime, PresenceState } from "@/lib/supabase-realtime"

type User = {
  user_id: string
  username: string
  online_at: string
  metadata?: any
}

export function usePresence(roomName: string, currentUser?: User) {
  const [onlineUsers, setOnlineUsers] = useState<User[]>([])
  const [isTracking, setIsTracking] = useState(false)

  useEffect(() => {
    if (!currentUser) return

    const channel = supabaseRealtime.channel(`presence:${roomName}`)

    // Listen to presence changes
    channel.on("presence", undefined, (payload: any) => {
      const users: User[] = payload.state || []
      setOnlineUsers(users)
      console.log(`[Presence] ${roomName} - ${users.length} users online`)
    })

    // Subscribe
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // Track current user
        channel.track({
          user_id: currentUser.user_id,
          username: currentUser.username,
          online_at: new Date().toISOString(),
          metadata: currentUser.metadata,
        } as PresenceState)
        setIsTracking(true)
      }
    })

    return () => {
      channel.untrack()
      channel.unsubscribe()
      supabaseRealtime.removeChannel(channel)
      setIsTracking(false)
    }
  }, [roomName, currentUser])

  return { onlineUsers, isTracking }
}

// Hook for dashboard-wide presence
export function useDashboardPresence(userId: string, username: string) {
  return usePresence("dashboard", {
    user_id: userId,
    username,
    online_at: new Date().toISOString(),
  })
}

// Hook for job-specific presence
export function useJobPresence(jobId: number, userId: string, username: string) {
  return usePresence(`job:${jobId}`, {
    user_id: userId,
    username,
    online_at: new Date().toISOString(),
    metadata: { job_id: jobId },
  })
}
