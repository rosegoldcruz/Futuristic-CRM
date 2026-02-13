/**
 * useRealtimeSubscription - Subscribe to real-time updates for any table
 */
import { useEffect, useCallback, useRef } from "react"
import {
  supabaseRealtime,
  getChannelName,
  RealtimeEvent,
  RealtimePayload,
  RealtimeCallback,
} from "@/lib/supabase-realtime"

type SubscriptionConfig<T> = {
  table: string
  id?: string | number
  onInsert?: (record: T) => void
  onUpdate?: (record: T, old: T | null) => void
  onDelete?: (record: T) => void
  enabled?: boolean
}

export function useRealtimeSubscription<T = any>(config: SubscriptionConfig<T>) {
  const { table, id, onInsert, onUpdate, onDelete, enabled = true } = config
  const channelRef = useRef<any>(null)

  const handlePayload = useCallback(
    (payload: RealtimePayload<T>) => {
      console.log(`[Realtime] ${payload.eventType} on ${table}`, payload)

      switch (payload.eventType) {
        case "INSERT":
          if (onInsert) onInsert(payload.new)
          break
        case "UPDATE":
          if (onUpdate) onUpdate(payload.new, payload.old)
          break
        case "DELETE":
          if (onDelete) onDelete(payload.old!)
          break
      }
    },
    [table, onInsert, onUpdate, onDelete]
  )

  useEffect(() => {
    if (!enabled) return

    const channelName = getChannelName(table, id)
    const channel = supabaseRealtime.channel(channelName)

    // Subscribe to events
    if (onInsert) {
      channel.on("INSERT", { table }, handlePayload as RealtimeCallback)
    }
    if (onUpdate) {
      channel.on("UPDATE", { table }, handlePayload as RealtimeCallback)
    }
    if (onDelete) {
      channel.on("DELETE", { table }, handlePayload as RealtimeCallback)
    }

    channel.subscribe((status) => {
      console.log(`[Realtime] ${channelName} status: ${status}`)
    })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        supabaseRealtime.removeChannel(channelRef.current)
      }
    }
  }, [table, id, enabled, handlePayload])

  return channelRef.current
}
