"use client"

import { useEffect, useState } from "react"
import { Save, Settings, Palette, Plug, ToggleLeft, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"

type BrandingSettings = {
  company_name?: string
  logo_url?: string
  primary_color?: string
  secondary_color?: string
  accent_color?: string
  font_family?: string
}

type Integration = {
  id: number
  integration_key: string
  integration_name: string
  integration_type: string
  status: string
  is_active: boolean
}

type FeatureFlag = {
  id: number
  flag_key: string
  flag_name: string
  is_enabled: boolean
  rollout_percentage: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

export default function SystemSettingsPage() {
  const [activeTab, setActiveTab] = useState("branding")
  const [branding, setBranding] = useState<BrandingSettings>({})
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (activeTab === "branding") loadBranding()
    else if (activeTab === "integrations") loadIntegrations()
    else if (activeTab === "features") loadFeatureFlags()
  }, [activeTab])

  async function loadBranding() {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/settings/branding/current`)
      if (res.ok) {
        const data = await res.json()
        setBranding(data)
      }
    } catch (err) {
      console.error("Failed to load branding:", err)
    } finally {
      setLoading(false)
    }
  }

  async function saveBranding() {
    try {
      setSaving(true)
      const res = await fetch(`${API_BASE}/settings/branding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branding),
      })
      if (res.ok) {
        alert("Branding settings saved!")
      }
    } catch (err) {
      console.error("Failed to save branding:", err)
    } finally {
      setSaving(false)
    }
  }

  async function loadIntegrations() {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/settings/integrations`)
      if (res.ok) {
        const data = await res.json()
        setIntegrations(data)
      }
    } catch (err) {
      console.error("Failed to load integrations:", err)
    } finally {
      setLoading(false)
    }
  }

  async function loadFeatureFlags() {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/settings/feature-flags`)
      if (res.ok) {
        const data = await res.json()
        setFeatureFlags(data)
      }
    } catch (err) {
      console.error("Failed to load feature flags:", err)
    } finally {
      setLoading(false)
    }
  }

  async function toggleFeatureFlag(flagKey: string, currentValue: boolean) {
    try {
      const res = await fetch(`${API_BASE}/settings/feature-flags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flag_key: flagKey,
          flag_name: flagKey,
          is_enabled: !currentValue,
        }),
      })
      if (res.ok) {
        await loadFeatureFlags()
      }
    } catch (err) {
      console.error("Failed to toggle feature flag:", err)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-semibold text-white">System Settings</h1>
        <p className="text-sm text-neutral-400">
          Configure system branding, integrations, and features
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-800">
        <button
          onClick={() => setActiveTab("branding")}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === "branding"
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          <Palette className="w-4 h-4 inline-block mr-2" />
          Branding
        </button>
        <button
          onClick={() => setActiveTab("integrations")}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === "integrations"
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          <Plug className="w-4 h-4 inline-block mr-2" />
          Integrations
        </button>
        <button
          onClick={() => setActiveTab("features")}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === "features"
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          <ToggleLeft className="w-4 h-4 inline-block mr-2" />
          Feature Flags
        </button>
      </div>

      {/* Branding Tab */}
      {activeTab === "branding" && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={branding.company_name || ""}
                onChange={(e) => setBranding({ ...branding, company_name: e.target.value })}
                className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-4 py-2 text-white"
                placeholder="AEON Solar"
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Primary Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={branding.primary_color || "#3b82f6"}
                    onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                    className="w-12 h-10 rounded border border-neutral-700"
                  />
                  <input
                    type="text"
                    value={branding.primary_color || "#3b82f6"}
                    onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                    className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-4 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Secondary Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={branding.secondary_color || "#10b981"}
                    onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                    className="w-12 h-10 rounded border border-neutral-700"
                  />
                  <input
                    type="text"
                    value={branding.secondary_color || "#10b981"}
                    onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                    className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-4 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Accent Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={branding.accent_color || "#f59e0b"}
                    onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })}
                    className="w-12 h-10 rounded border border-neutral-700"
                  />
                  <input
                    type="text"
                    value={branding.accent_color || "#f59e0b"}
                    onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })}
                    className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-4 py-2 text-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Font Family
              </label>
              <select
                value={branding.font_family || "Inter"}
                onChange={(e) => setBranding({ ...branding, font_family: e.target.value })}
                className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-4 py-2 text-white"
              >
                <option value="Inter">Inter</option>
                <option value="Roboto">Roboto</option>
                <option value="Open Sans">Open Sans</option>
                <option value="Lato">Lato</option>
                <option value="Montserrat">Montserrat</option>
              </select>
            </div>

            <div className="pt-4">
              <Button onClick={saveBranding} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : "Save Branding"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === "integrations" && (
        <div className="space-y-4">
          {loading ? (
            <p className="text-center text-neutral-400 py-8">Loading integrations...</p>
          ) : integrations.length === 0 ? (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-12 text-center">
              <Plug className="w-16 h-16 text-neutral-700 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No Integrations Configured</h3>
              <p className="text-sm text-neutral-400">
                Connect third-party services to enhance your workflow
              </p>
            </div>
          ) : (
            integrations.map((integration) => (
              <div
                key={integration.id}
                className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Plug className="w-8 h-8 text-blue-400" />
                    <div>
                      <h3 className="font-medium text-white">{integration.integration_name}</h3>
                      <p className="text-xs text-neutral-500 capitalize">{integration.integration_type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        integration.status === "active"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-neutral-500/20 text-neutral-400"
                      }`}
                    >
                      {integration.status}
                    </span>
                    <Button variant="outline" size="sm">
                      Configure
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Feature Flags Tab */}
      {activeTab === "features" && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
          {loading ? (
            <p className="text-center text-neutral-400">Loading feature flags...</p>
          ) : (
            <div className="space-y-3">
              {featureFlags.map((flag) => (
                <div
                  key={flag.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-neutral-800 bg-neutral-950/50"
                >
                  <div>
                    <p className="font-medium text-white">{flag.flag_name}</p>
                    <p className="text-xs text-neutral-500">{flag.flag_key}</p>
                  </div>
                  <button
                    onClick={() => toggleFeatureFlag(flag.flag_key, flag.is_enabled)}
                    className={`w-12 h-6 rounded-full transition relative ${
                      flag.is_enabled ? "bg-blue-600" : "bg-neutral-700"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition ${
                        flag.is_enabled ? "right-1" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              ))}
              {featureFlags.length === 0 && (
                <p className="text-center text-neutral-500 py-8">No feature flags configured</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
