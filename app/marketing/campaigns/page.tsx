"use client"

import { useEffect, useState } from "react"
import {
  TrendingUp,
  Users,
  MousePointerClick,
  DollarSign,
  BarChart3,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"

type CampaignAnalytics = {
  campaign_id?: number
  campaign_name?: string
  total_views: number
  total_conversions: number
  conversion_rate: number
  total_value: number
  unique_visitors: number
  top_sources: Array<{
    utm_source: string
    views: number
    unique_visitors: number
  }>
}

type LandingPage = {
  id: number
  page_slug: string
  page_name: string
  page_title?: string
  is_active: boolean
  campaign_id?: number
  variant_name?: string
}

type PageAnalytics = {
  landing_page_id: number
  page_name: string
  page_slug: string
  views: number
  conversions: number
  conversion_rate: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

export default function CampaignsDashboard() {
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null)
  const [landingPages, setLandingPages] = useState<LandingPage[]>([])
  const [pageAnalytics, setPageAnalytics] = useState<Map<number, PageAnalytics>>(new Map())
  const [loading, setLoading] = useState(false)
  const [selectedDays, setSelectedDays] = useState(30)

  useEffect(() => {
    loadData()
  }, [selectedDays])

  async function loadData() {
    try {
      setLoading(true)
      
      // Load campaign analytics
      const analyticsRes = await fetch(
        `${API_BASE}/landing-pages/analytics/campaign?days=${selectedDays}`,
        { cache: "no-store" }
      )
      if (analyticsRes.ok) {
        const data = await analyticsRes.json()
        setAnalytics(data)
      }

      // Load landing pages
      const pagesRes = await fetch(`${API_BASE}/landing-pages/`, { cache: "no-store" })
      if (pagesRes.ok) {
        const pages = await pagesRes.json()
        setLandingPages(pages)

        // Load analytics for each page
        const pageAnalyticsMap = new Map()
        for (const page of pages) {
          const pageAnalyticsRes = await fetch(
            `${API_BASE}/landing-pages/${page.id}/analytics`,
            { cache: "no-store" }
          )
          if (pageAnalyticsRes.ok) {
            const pageData = await pageAnalyticsRes.json()
            pageAnalyticsMap.set(page.id, pageData)
          }
        }
        setPageAnalytics(pageAnalyticsMap)
      }
    } catch (err) {
      console.error("Failed to load campaign data:", err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-neutral-400">Loading campaign analytics...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Campaign Analytics</h1>
          <p className="text-sm text-neutral-400">UTM tracking and landing page performance</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={selectedDays === 7 ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedDays(7)}
          >
            7 Days
          </Button>
          <Button
            variant={selectedDays === 30 ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedDays(30)}
          >
            30 Days
          </Button>
          <Button
            variant={selectedDays === 90 ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedDays(90)}
          >
            90 Days
          </Button>
        </div>
      </header>

      {/* Metrics Cards */}
      {analytics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-400" />
              <p className="text-xs text-neutral-400">Total Views</p>
            </div>
            <p className="text-2xl font-bold text-white">{analytics.total_views.toLocaleString()}</p>
            <p className="text-xs text-neutral-500 mt-1">
              {analytics.unique_visitors.toLocaleString()} unique
            </p>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <MousePointerClick className="w-4 h-4 text-emerald-400" />
              <p className="text-xs text-neutral-400">Conversions</p>
            </div>
            <p className="text-2xl font-bold text-white">
              {analytics.total_conversions.toLocaleString()}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              {analytics.conversion_rate.toFixed(1)}% conversion rate
            </p>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-amber-400" />
              <p className="text-xs text-neutral-400">Total Value</p>
            </div>
            <p className="text-2xl font-bold text-white">
              ${analytics.total_value.toLocaleString()}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              ${analytics.total_conversions > 0 ? (analytics.total_value / analytics.total_conversions).toFixed(2) : 0} avg
            </p>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <p className="text-xs text-neutral-400">Avg Per Visit</p>
            </div>
            <p className="text-2xl font-bold text-white">
              ${analytics.total_views > 0 ? (analytics.total_value / analytics.total_views).toFixed(2) : 0}
            </p>
          </div>
        </div>
      )}

      {/* Top Sources */}
      {analytics && analytics.top_sources.length > 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Top Traffic Sources
          </h2>
          <div className="space-y-3">
            {analytics.top_sources.map((source, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white capitalize">
                      {source.utm_source || "Direct"}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {source.unique_visitors} unique
                    </span>
                  </div>
                  <div className="mt-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{
                        width: `${analytics.total_views > 0 ? (source.views / analytics.total_views) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="text-sm text-neutral-400 ml-4 min-w-[60px] text-right">
                  {source.views} views
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Landing Pages */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Landing Pages</h2>
        <div className="space-y-3">
          {landingPages.map((page) => {
            const analytics = pageAnalytics.get(page.id)
            return (
              <div
                key={page.id}
                className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-medium text-white">{page.page_name}</h3>
                    <p className="text-xs text-neutral-500">/{page.page_slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {page.is_active ? (
                      <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-300">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded bg-neutral-500/20 text-neutral-400">
                        Inactive
                      </span>
                    )}
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {analytics && (
                  <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-neutral-800">
                    <div>
                      <p className="text-xs text-neutral-500">Views</p>
                      <p className="text-lg font-semibold text-white">{analytics.views}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Conversions</p>
                      <p className="text-lg font-semibold text-white">{analytics.conversions}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Conv. Rate</p>
                      <p className="text-lg font-semibold text-emerald-400">
                        {analytics.conversion_rate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {landingPages.length === 0 && (
            <p className="text-center text-neutral-500 py-8">
              No landing pages created yet
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
