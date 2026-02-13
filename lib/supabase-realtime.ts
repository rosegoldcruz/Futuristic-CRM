/**
 * Supabase Realtime Configuration
 * Mock implementation - in production, connect to actual Supabase
 */

export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE"

export type RealtimePayload<T = any> = {
  eventType: RealtimeEvent
  new: T
  old: T | null
  schema: string
  table: string
  commit_timestamp: string
}

export type RealtimeCallback<T = any> = (payload: RealtimePayload<T>) => void

export type PresenceState = {
  user_id: string
  username: string
  online_at: string
  metadata?: any
}

export class MockRealtimeChannel {
  private callbacks: Map<string, RealtimeCallback[]> = new Map()
  private presenceState: Map<string, PresenceState> = new Map()
  public channelName: string

  constructor(channelName: string) {
    this.channelName = channelName
  }

  on(
    event: RealtimeEvent | "presence",
    filter: { event?: string; schema?: string; table?: string } | undefined,
    callback: RealtimeCallback | ((state: any) => void)
  ): MockRealtimeChannel {
    const key = `${event}:${filter?.table || "presence"}`
    if (!this.callbacks.has(key)) {
      this.callbacks.set(key, [])
    }
    this.callbacks.get(key)!.push(callback as RealtimeCallback)
    return this
  }

  subscribe(callback?: (status: string) => void): MockRealtimeChannel {
    if (callback) {
      setTimeout(() => callback("SUBSCRIBED"), 100)
    }
    return this
  }

  unsubscribe(): Promise<{ error: null }> {
    this.callbacks.clear()
    return Promise.resolve({ error: null })
  }

  track(state: PresenceState): Promise<{ error: null }> {
    this.presenceState.set(state.user_id, state)
    this.triggerPresenceUpdate()
    return Promise.resolve({ error: null })
  }

  untrack(): Promise<{ error: null }> {
    this.presenceState.clear()
    return Promise.resolve({ error: null })
  }

  private triggerPresenceUpdate() {
    const presenceCallbacks = this.callbacks.get("presence:presence") || []
    const state = Array.from(this.presenceState.values())
    presenceCallbacks.forEach((cb) => cb({ state } as any))
  }

  // Simulate real-time update (for testing)
  simulateUpdate<T>(table: string, eventType: RealtimeEvent, data: T) {
    const key = `${eventType}:${table}`
    const callbacks = this.callbacks.get(key) || []
    callbacks.forEach((cb) =>
      cb({
        eventType,
        new: data,
        old: null,
        schema: "public",
        table,
        commit_timestamp: new Date().toISOString(),
      })
    )
  }
}

export class MockRealtimeClient {
  private channels: Map<string, MockRealtimeChannel> = new Map()

  channel(name: string): MockRealtimeChannel {
    if (!this.channels.has(name)) {
      this.channels.set(name, new MockRealtimeChannel(name))
    }
    return this.channels.get(name)!
  }

  removeChannel(channel: MockRealtimeChannel): Promise<{ error: null }> {
    this.channels.delete(channel.channelName)
    return Promise.resolve({ error: null })
  }
}

// Mock Supabase client
export const supabaseRealtime = new MockRealtimeClient()

// Helper to generate channel names
export function getChannelName(table: string, id?: string | number): string {
  return id ? `${table}:${id}` : table
}

// In production, use actual Supabase:
// import { createClient } from '@supabase/supabase-js'
// export const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
// )
