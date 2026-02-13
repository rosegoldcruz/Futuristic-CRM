"use client"

import { useState } from "react"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

export default function AiToolsPage() {
  const [prompt, setPrompt] = useState("")
  const [roomPhoto, setRoomPhoto] = useState<File | null>(null)
  const [style, setStyle] = useState("modern-white")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function handleVisualize(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setResult(null)

    if (!roomPhoto) {
      setError("Upload a room photo first.")
      return
    }

    // Placeholder call: wired for future AR/AI backend.
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("file", roomPhoto)
      formData.append("style", style)
      formData.append("prompt", prompt)

      // Call a future endpoint, for now just simulate a response:
      // const res = await fetch(`${API_BASE}/ar-visualizer/render`, {
      //   method: "POST",
      //   body: formData,
      // })
      // if (!res.ok) throw new Error("Visualizer failed")
      // const json = await res.json()
      // setResult(json.image_url)

      await new Promise((resolve) => setTimeout(resolve, 800))
      setResult(
        "AR visualizer job queued – wire this to your Nano Banana / external renderer when ready.",
      )
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">AI Tools & AR Visualizer</h1>
          <p className="text-neutral-400 text-sm">
            One lane for cabinet refacing AR mockups. One lane for backend intelligence.
          </p>
        </div>
      </div>

      {error && (
        <div className="border border-red-700 bg-red-900/40 text-red-200 px-4 py-2 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* AR Visualizer Card */}
        <div className="border border-neutral-800 rounded-lg bg-neutral-950 p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Kitchen AR Visualizer</h2>
            <p className="text-xs text-neutral-400 mt-1">
              Upload a &quot;before&quot; photo and choose a refacing style. This is the lane
              you wire into Nano Banana / external render APIs.
            </p>
          </div>

          <form onSubmit={handleVisualize} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Room / Kitchen Photo
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setRoomPhoto(e.target.files?.[0] || null)}
                className="block w-full text-xs text-neutral-300 file:mr-2 file:rounded file:border-0 file:bg-orange-500 file:text-black file:px-3 file:py-1 file:text-xs"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-400 mb-1">Style Preset</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
              >
                <option value="modern-white">Modern – White shaker, black pulls</option>
                <option value="warm-wood">Warm wood – slab fronts, brass hardware</option>
                <option value="two-tone">
                  Two tone – white uppers, navy lowers, gold hardware
                </option>
                <option value="matte-black">Matte black – brass pulls, oak accents</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Optional AI Prompt (extra instructions)
              </label>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="E.g. keep existing flooring, add under-cabinet lighting, keep layout the same."
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded bg-orange-500 text-black text-sm font-medium disabled:opacity-60"
              >
                {loading ? "Queuing AR render..." : "Generate AR Mockup"}
              </button>
            </div>
          </form>

          {result && (
            <div className="mt-4 border border-neutral-800 rounded-lg p-3 bg-neutral-900">
              <div className="text-xs text-neutral-300">{result}</div>
            </div>
          )}
        </div>

        {/* AI Ops / Automation Card */}
        <div className="border border-neutral-800 rounded-lg bg-neutral-950 p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Backend AI Automations</h2>
            <p className="text-xs text-neutral-400 mt-1">
              This panel is for things like: &quot;summarize this job&quot;, &quot;generate
              scope from photos&quot;, &quot;draft homeowner email from quote&quot;.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button className="border border-neutral-700 rounded-lg px-3 py-3 text-left bg-neutral-900 hover:bg-neutral-800">
              <div className="text-sm text-white">Summarize Job</div>
              <div className="text-[11px] text-neutral-400 mt-1">
                Feed it leads + quotes + files, get a clean scope summary.
              </div>
            </button>

            <button className="border border-neutral-700 rounded-lg px-3 py-3 text-left bg-neutral-900 hover:bg-neutral-800">
              <div className="text-sm text-white">Generate Homeowner Email</div>
              <div className="text-[11px] text-neutral-400 mt-1">
                Use quote totals + style to draft a follow-up email.
              </div>
            </button>

            <button className="border border-neutral-700 rounded-lg px-3 py-3 text-left bg-neutral-900 hover:bg-neutral-800">
              <div className="text-sm text-white">Material Takeoff Check</div>
              <div className="text-[11px] text-neutral-400 mt-1">
                Cross-check doors, panels, and hardware before ordering.
              </div>
            </button>

            <button className="border border-neutral-700 rounded-lg px-3 py-3 text-left bg-neutral-900 hover:bg-neutral-800">
              <div className="text-sm text-white">Installer Brief</div>
              <div className="text-[11px] text-neutral-400 mt-1">
                Compress all job data into a one-page installer brief.
              </div>
            </button>
          </div>

          <div className="mt-4 border border-dashed border-neutral-700 rounded-lg p-3 text-xs text-neutral-500">
            Wire each button into real endpoints when you are ready:
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>POST /ai/summarize-job with lead_id / job_id</li>
              <li>POST /ai/email-homeowner with quote_id</li>
              <li>POST /ai/material-check with quote_id + files</li>
              <li>POST /ai/installer-brief with job_id</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
