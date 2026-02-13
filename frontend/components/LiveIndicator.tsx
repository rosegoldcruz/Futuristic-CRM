/**
 * LiveIndicator - Shows real-time connection status
 */
import { useEffect, useState } from "react"
import { Wifi, WifiOff } from "lucide-react"

type LiveIndicatorProps = {
  lastUpdate?: Date
  showTimestamp?: boolean
  size?: "sm" | "md" | "lg"
}

export function LiveIndicator({
  lastUpdate,
  showTimestamp = false,
  size = "sm",
}: LiveIndicatorProps) {
  const [isLive, setIsLive] = useState(true)
  const [timeSinceUpdate, setTimeSinceUpdate] = useState<string>("")

  useEffect(() => {
    if (!lastUpdate) return

    const interval = setInterval(() => {
      const now = new Date()
      const diff = now.getTime() - lastUpdate.getTime()
      const seconds = Math.floor(diff / 1000)

      if (seconds < 60) {
        setTimeSinceUpdate(`${seconds}s ago`)
      } else if (seconds < 3600) {
        setTimeSinceUpdate(`${Math.floor(seconds / 60)}m ago`)
      } else {
        setTimeSinceUpdate(`${Math.floor(seconds / 3600)}h ago`)
      }

      // Consider offline if no update in 5 minutes
      setIsLive(seconds < 300)
    }, 1000)

    return () => clearInterval(interval)
  }, [lastUpdate])

  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  }

  return (
    <div className="flex items-center gap-2">
      {isLive ? (
        <>
          <div className={`${sizeClasses[size]} bg-emerald-500 rounded-full animate-pulse`} />
          {showTimestamp && lastUpdate && (
            <span className="text-xs text-neutral-500">{timeSinceUpdate}</span>
          )}
        </>
      ) : (
        <>
          <div className={`${sizeClasses[size]} bg-red-500 rounded-full`} />
          {showTimestamp && (
            <span className="text-xs text-neutral-500">Offline</span>
          )}
        </>
      )}
    </div>
  )
}

export function ConnectionStatus() {
  const [isConnected, setIsConnected] = useState(true)

  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800">
      {isConnected ? (
        <>
          <Wifi className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-emerald-400 font-medium">Live</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4 text-red-400" />
          <span className="text-xs text-red-400 font-medium">Offline</span>
        </>
      )}
    </div>
  )
}

export function OnlineUsers({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
          <div
            key={i}
            className="w-6 h-6 rounded-full bg-blue-500 border-2 border-neutral-900 flex items-center justify-center"
          >
            <span className="text-xs text-white font-medium">
              {String.fromCharCode(65 + i)}
            </span>
          </div>
        ))}
      </div>
      {count > 3 && (
        <span className="text-xs text-neutral-400">+{count - 3} more</span>
      )}
    </div>
  )
}
