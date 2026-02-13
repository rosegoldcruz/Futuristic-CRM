/**
 * Entity-specific real-time hooks
 */
import { useState, useEffect, useCallback } from "react"
import { useRealtimeSubscription } from "./useRealtimeSubscription"

// Jobs
export function useRealtimeJobs() {
  const [jobs, setJobs] = useState<any[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useRealtimeSubscription({
    table: "jobs",
    onInsert: (job) => {
      setJobs((prev) => [job, ...prev])
      setLastUpdate(new Date())
    },
    onUpdate: (job) => {
      setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)))
      setLastUpdate(new Date())
    },
    onDelete: (job) => {
      setJobs((prev) => prev.filter((j) => j.id !== job.id))
      setLastUpdate(new Date())
    },
  })

  return { jobs, lastUpdate, setJobs }
}

// Quotes
export function useRealtimeQuotes() {
  const [quotes, setQuotes] = useState<any[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useRealtimeSubscription({
    table: "quotes",
    onInsert: (quote) => {
      setQuotes((prev) => [quote, ...prev])
      setLastUpdate(new Date())
    },
    onUpdate: (quote) => {
      setQuotes((prev) => prev.map((q) => (q.id === quote.id ? quote : q)))
      setLastUpdate(new Date())
    },
    onDelete: (quote) => {
      setQuotes((prev) => prev.filter((q) => q.id !== quote.id))
      setLastUpdate(new Date())
    },
  })

  return { quotes, lastUpdate, setQuotes }
}

// Work Orders
export function useRealtimeWorkOrders() {
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useRealtimeSubscription({
    table: "work_orders",
    onInsert: (wo) => {
      setWorkOrders((prev) => [wo, ...prev])
      setLastUpdate(new Date())
    },
    onUpdate: (wo) => {
      setWorkOrders((prev) => prev.map((w) => (w.id === wo.id ? wo : w)))
      setLastUpdate(new Date())
    },
    onDelete: (wo) => {
      setWorkOrders((prev) => prev.filter((w) => w.id !== wo.id))
      setLastUpdate(new Date())
    },
  })

  return { workOrders, lastUpdate, setWorkOrders }
}

// Payments
export function useRealtimePayments() {
  const [payments, setPayments] = useState<any[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useRealtimeSubscription({
    table: "payments",
    onInsert: (payment) => {
      setPayments((prev) => [payment, ...prev])
      setLastUpdate(new Date())
    },
    onUpdate: (payment) => {
      setPayments((prev) => prev.map((p) => (p.id === payment.id ? payment : p)))
      setLastUpdate(new Date())
    },
    onDelete: (payment) => {
      setPayments((prev) => prev.filter((p) => p.id !== payment.id))
      setLastUpdate(new Date())
    },
  })

  return { payments, lastUpdate, setPayments }
}

// Files
export function useRealtimeFiles() {
  const [files, setFiles] = useState<any[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useRealtimeSubscription({
    table: "files",
    onInsert: (file) => {
      setFiles((prev) => [file, ...prev])
      setLastUpdate(new Date())
    },
    onUpdate: (file) => {
      setFiles((prev) => prev.map((f) => (f.id === file.id ? file : f)))
      setLastUpdate(new Date())
    },
    onDelete: (file) => {
      setFiles((prev) => prev.filter((f) => f.id !== file.id))
      setLastUpdate(new Date())
    },
  })

  return { files, lastUpdate, setFiles }
}

// Generic hook with optimistic updates
export function useRealtimeEntity<T extends { id: number | string }>(
  table: string,
  initialData: T[] = []
) {
  const [data, setData] = useState<T[]>(initialData)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [isUpdating, setIsUpdating] = useState(false)

  useRealtimeSubscription<T>({
    table,
    onInsert: (item) => {
      setData((prev) => [item, ...prev])
      setLastUpdate(new Date())
      setIsUpdating(false)
    },
    onUpdate: (item) => {
      setData((prev) => prev.map((i) => (i.id === item.id ? item : i)))
      setLastUpdate(new Date())
      setIsUpdating(false)
    },
    onDelete: (item) => {
      setData((prev) => prev.filter((i) => i.id !== item.id))
      setLastUpdate(new Date())
      setIsUpdating(false)
    },
  })

  // Optimistic update
  const optimisticUpdate = useCallback(
    (id: number | string, updates: Partial<T>) => {
      setIsUpdating(true)
      setData((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        )
      )
    },
    []
  )

  // Optimistic create
  const optimisticCreate = useCallback((item: T) => {
    setIsUpdating(true)
    setData((prev) => [item, ...prev])
  }, [])

  // Optimistic delete
  const optimisticDelete = useCallback((id: number | string) => {
    setIsUpdating(true)
    setData((prev) => prev.filter((item) => item.id !== id))
  }, [])

  return {
    data,
    setData,
    lastUpdate,
    isUpdating,
    optimisticUpdate,
    optimisticCreate,
    optimisticDelete,
  }
}
