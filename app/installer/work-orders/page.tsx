"use client"

import { useEffect, useState } from "react"
import {
  CheckCircle,
  Clock,
  Camera,
  FileSignature,
  Play,
  Square,
  CheckSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"

type WorkOrderTask = {
  id: number
  task_name: string
  description?: string
  status: string
  checklist_items?: Array<{ item: string; completed: boolean }>
}

type WorkOrderPhoto = {
  id: number
  photo_type: string
  file_url: string
  caption?: string
  created_at: string
}

type TimeEntry = {
  id: number
  entry_type: string
  started_at: string
  ended_at?: string
  duration_minutes?: number
}

type WorkOrderProgress = {
  total_tasks: number
  completed_tasks: number
  progress_percentage: number
  total_time_minutes: number
  photos_count: number
  signatures_count: number
}

type WorkOrder = {
  id: number
  job_id: number
  status: string
  scheduled_date?: string
  project_details?: any
  special_instructions?: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

export default function InstallerWorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null)
  const [tasks, setTasks] = useState<WorkOrderTask[]>([])
  const [photos, setPhotos] = useState<WorkOrderPhoto[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [progress, setProgress] = useState<WorkOrderProgress | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTimeEntry, setActiveTimeEntry] = useState<TimeEntry | null>(null)

  // Hardcoded installer ID for demo (in production, get from auth)
  const installerId = 1

  useEffect(() => {
    loadWorkOrders()
  }, [])

  async function loadWorkOrders() {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/work-orders/?installer_id=${installerId}`, {
        cache: "no-store",
      })
      if (res.ok) {
        const data = await res.json()
        setWorkOrders(data)
      }
    } catch (err) {
      console.error("Failed to load work orders:", err)
    } finally {
      setLoading(false)
    }
  }

  async function loadWorkOrderDetails(workOrderId: number) {
    try {
      const [tasksRes, photosRes, timeRes, progressRes] = await Promise.all([
        fetch(`${API_BASE}/installer/work-orders/${workOrderId}/tasks`),
        fetch(`${API_BASE}/installer/work-orders/${workOrderId}/photos`),
        fetch(`${API_BASE}/installer/work-orders/${workOrderId}/time-entries?installer_id=${installerId}`),
        fetch(`${API_BASE}/installer/work-orders/${workOrderId}/progress`),
      ])

      if (tasksRes.ok) setTasks(await tasksRes.json())
      if (photosRes.ok) setPhotos(await photosRes.json())
      if (timeRes.ok) {
        const entries = await timeRes.json()
        setTimeEntries(entries)
        // Find active entry (no ended_at)
        setActiveTimeEntry(entries.find((e: TimeEntry) => !e.ended_at) || null)
      }
      if (progressRes.ok) setProgress(await progressRes.json())
    } catch (err) {
      console.error("Failed to load work order details:", err)
    }
  }

  async function completeTask(taskId: number) {
    try {
      const res = await fetch(`${API_BASE}/installer/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed_by: installerId }),
      })
      if (res.ok && selectedWorkOrder) {
        await loadWorkOrderDetails(selectedWorkOrder.id)
      }
    } catch (err) {
      console.error("Failed to complete task:", err)
    }
  }

  async function startTimeEntry(entryType: string) {
    if (!selectedWorkOrder) return
    try {
      const res = await fetch(
        `${API_BASE}/installer/work-orders/${selectedWorkOrder.id}/time-entries/start?installer_id=${installerId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entry_type: entryType }),
        }
      )
      if (res.ok && selectedWorkOrder) {
        await loadWorkOrderDetails(selectedWorkOrder.id)
      }
    } catch (err) {
      console.error("Failed to start time entry:", err)
    }
  }

  async function stopTimeEntry() {
    if (!activeTimeEntry) return
    try {
      const res = await fetch(`${API_BASE}/installer/time-entries/${activeTimeEntry.id}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (res.ok && selectedWorkOrder) {
        await loadWorkOrderDetails(selectedWorkOrder.id)
      }
    } catch (err) {
      console.error("Failed to stop time entry:", err)
    }
  }

  function selectWorkOrder(wo: WorkOrder) {
    setSelectedWorkOrder(wo)
    loadWorkOrderDetails(wo.id)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-neutral-400">Loading work orders...</p>
      </div>
    )
  }

  if (!selectedWorkOrder) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <header>
          <h1 className="text-2xl font-semibold text-white">My Work Orders</h1>
          <p className="text-sm text-neutral-400">Select a work order to begin</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workOrders.map((wo) => (
            <div
              key={wo.id}
              onClick={() => selectWorkOrder(wo)}
              className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 hover:bg-neutral-800 cursor-pointer transition"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">WO #{wo.id}</span>
                <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/50">
                  {wo.status}
                </span>
              </div>
              <p className="text-sm text-neutral-400">Job #{wo.job_id}</p>
              {wo.scheduled_date && (
                <p className="text-xs text-neutral-500 mt-2">
                  Scheduled: {new Date(wo.scheduled_date).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}

          {workOrders.length === 0 && (
            <div className="col-span-full text-center py-12 text-neutral-500">
              No work orders assigned
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedWorkOrder(null)}
            className="mb-2 text-neutral-400"
          >
            ← Back to Work Orders
          </Button>
          <h1 className="text-2xl font-semibold text-white">Work Order #{selectedWorkOrder.id}</h1>
          <p className="text-sm text-neutral-400">Job #{selectedWorkOrder.job_id}</p>
        </div>
      </header>

      {/* Progress Summary */}
      {progress && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckSquare className="w-4 h-4 text-emerald-400" />
              <p className="text-xs text-neutral-400">Progress</p>
            </div>
            <p className="text-2xl font-bold text-white">{progress.progress_percentage.toFixed(0)}%</p>
            <p className="text-xs text-neutral-500">
              {progress.completed_tasks} / {progress.total_tasks} tasks
            </p>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-blue-400" />
              <p className="text-xs text-neutral-400">Time</p>
            </div>
            <p className="text-2xl font-bold text-white">
              {Math.floor(progress.total_time_minutes / 60)}h {progress.total_time_minutes % 60}m
            </p>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Camera className="w-4 h-4 text-purple-400" />
              <p className="text-xs text-neutral-400">Photos</p>
            </div>
            <p className="text-2xl font-bold text-white">{progress.photos_count}</p>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileSignature className="w-4 h-4 text-amber-400" />
              <p className="text-xs text-neutral-400">Signatures</p>
            </div>
            <p className="text-2xl font-bold text-white">{progress.signatures_count}</p>
          </div>
        </div>
      )}

      {/* Time Tracking */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Time Tracking</h2>
        {activeTimeEntry ? (
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-emerald-400 font-medium">● Active: {activeTimeEntry.entry_type}</p>
              <p className="text-xs text-neutral-500">
                Started {new Date(activeTimeEntry.started_at).toLocaleTimeString()}
              </p>
            </div>
            <Button
              onClick={stopTimeEntry}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => startTimeEntry("work")} className="bg-emerald-600 hover:bg-emerald-700">
              <Play className="w-4 h-4 mr-2" />
              Start Work
            </Button>
            <Button onClick={() => startTimeEntry("travel")} variant="outline" className="border-neutral-700">
              Start Travel
            </Button>
            <Button onClick={() => startTimeEntry("break")} variant="outline" className="border-neutral-700">
              Start Break
            </Button>
          </div>
        )}
      </div>

      {/* Tasks */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Tasks</h2>
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-medium text-white">{task.task_name}</h3>
                  {task.description && (
                    <p className="text-sm text-neutral-400 mt-1">{task.description}</p>
                  )}
                </div>
                {task.status === "completed" ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Button
                    size="sm"
                    onClick={() => completeTask(task.id)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Complete
                  </Button>
                )}
              </div>

              {task.checklist_items && task.checklist_items.length > 0 && (
                <div className="mt-3 space-y-1">
                  {task.checklist_items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        readOnly
                        className="w-4 h-4 rounded border-neutral-700"
                      />
                      <span className={item.completed ? "text-neutral-500 line-through" : "text-neutral-300"}>
                        {item.item}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {tasks.length === 0 && (
            <p className="text-center text-neutral-500 py-8">No tasks assigned</p>
          )}
        </div>
      </div>

      {/* Photos */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Photos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="rounded-lg border border-neutral-800 overflow-hidden">
              <div className="aspect-square bg-neutral-950 flex items-center justify-center">
                <Camera className="w-8 h-8 text-neutral-600" />
              </div>
              <div className="p-2 bg-neutral-900">
                <p className="text-xs text-neutral-400 capitalize">{photo.photo_type}</p>
                {photo.caption && <p className="text-xs text-neutral-500 mt-1">{photo.caption}</p>}
              </div>
            </div>
          ))}

          <button className="aspect-square rounded-lg border-2 border-dashed border-neutral-700 hover:border-neutral-600 flex items-center justify-center text-neutral-500 hover:text-neutral-400 transition">
            <div className="text-center">
              <Camera className="w-8 h-8 mx-auto mb-2" />
              <p className="text-xs">Upload Photo</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
