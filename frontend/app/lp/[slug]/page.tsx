"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { CheckCircle, ArrowRight, Phone, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"

type LandingPage = {
  id: number
  page_slug: string
  page_name: string
  page_title?: string
  page_content?: string
  page_template: string
  seo_title?: string
  seo_description?: string
  metadata?: any
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

export default function DynamicLandingPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  
  const [page, setPage] = useState<LandingPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  })
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    loadPage()
  }, [slug])

  async function loadPage() {
    try {
      setLoading(true)
      
      // Load landing page
      const res = await fetch(`${API_BASE}/landing-pages/slug/${slug}`, {
        cache: "no-store",
      })
      
      if (res.ok) {
        const pageData = await res.json()
        setPage(pageData)

        // Track page view with UTM parameters
        const utm_source = searchParams.get("utm_source")
        const utm_medium = searchParams.get("utm_medium")
        const utm_campaign = searchParams.get("utm_campaign")
        const utm_term = searchParams.get("utm_term")
        const utm_content = searchParams.get("utm_content")

        // Generate or retrieve session ID
        let sessionId = localStorage.getItem("session_id")
        if (!sessionId) {
          sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          localStorage.setItem("session_id", sessionId)
        }

        // Track the view
        await fetch(`${API_BASE}/landing-pages/track/view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            landing_page_id: pageData.id,
            session_id: sessionId,
            utm_source,
            utm_medium,
            utm_campaign,
            utm_term,
            utm_content,
            referrer_url: document.referrer || null,
          }),
        })
      }
    } catch (err) {
      console.error("Failed to load landing page:", err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      // In production, this would create a lead and track conversion
      const sessionId = localStorage.getItem("session_id")
      
      // Track conversion
      if (page) {
        await fetch(`${API_BASE}/landing-pages/track/conversion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            landing_page_id: page.id,
            conversion_type: "lead",
            utm_source: searchParams.get("utm_source"),
            utm_medium: searchParams.get("utm_medium"),
            utm_campaign: searchParams.get("utm_campaign"),
            metadata: formData,
          }),
        })
      }

      setSubmitted(true)
    } catch (err) {
      console.error("Failed to submit:", err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 to-neutral-950">
        <p className="text-neutral-400">Loading...</p>
      </div>
    )
  }

  if (!page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 to-neutral-950">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Page Not Found</h1>
          <p className="text-neutral-400">This landing page does not exist or is no longer active.</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-950 to-neutral-950 p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Thank You!</h2>
          <p className="text-neutral-300 mb-6">
            We've received your request. Our team will contact you within 24 hours.
          </p>
          <Button
            onClick={() => window.location.href = "/"}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Return to Home
          </Button>
        </div>
      </div>
    )
  }

  // Render landing page based on template
  if (page.page_template === "promo") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-950 via-neutral-950 to-blue-950">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            {page.page_title || page.page_name}
          </h1>
          <p className="text-xl text-neutral-300 mb-8 max-w-2xl mx-auto">
            {page.seo_description || "Transform your home with clean, renewable solar energy"}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              Get Your Free Quote <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" className="border-neutral-600 text-white">
              Learn More
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "Save Money", desc: "Reduce your electricity bills by up to 70%" },
              { title: "Go Green", desc: "Reduce your carbon footprint with clean energy" },
              { title: "Increase Value", desc: "Add value to your home with solar panels" },
            ].map((feature, idx) => (
              <div key={idx} className="text-center">
                <div className="w-16 h-16 bg-blue-500/20 border-2 border-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-neutral-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact Form */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto bg-neutral-900/50 border border-neutral-800 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              Get Your Free Quote
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Message (Optional)
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-4 py-2 text-white"
                />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                Request Free Quote
              </Button>
            </form>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-neutral-800 py-8">
          <div className="container mx-auto px-4 text-center text-neutral-500 text-sm">
            <p>&copy; {new Date().getFullYear()} AEON Solar. All rights reserved.</p>
          </div>
        </footer>
      </div>
    )
  }

  // Default template
  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">{page.page_title || page.page_name}</h1>
        {page.page_content && (
          <div className="prose prose-invert" dangerouslySetInnerHTML={{ __html: page.page_content }} />
        )}
      </div>
    </div>
  )
}
