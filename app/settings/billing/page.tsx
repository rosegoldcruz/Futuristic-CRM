"use client"

import { useEffect, useState } from "react"
import { CreditCard, Check, Zap, TrendingUp, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

type SubscriptionPlan = {
  id: number
  plan_key: string
  name: string
  description: string
  tier: string
  price_monthly: number
  price_yearly: number
  features: string[]
  limits: Record<string, number>
  is_active: boolean
}

type Subscription = {
  id: number
  stripe_subscription_id: string
  plan_id: number
  status: string
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

export default function BillingPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")
  
  // Mock customer ID - in production, get from auth context
  const customerId = 1

  useEffect(() => {
    loadPlans()
    loadSubscription()
  }, [])

  async function loadPlans() {
    try {
      const res = await fetch(`${API_BASE}/billing/plans`)
      if (res.ok) {
        const data = await res.json()
        setPlans(data)
      }
    } catch (err) {
      console.error("Failed to load plans:", err)
    }
  }

  async function loadSubscription() {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/billing/subscriptions/customer/${customerId}`)
      if (res.ok) {
        const data = await res.json()
        setSubscription(data)
      }
    } catch (err) {
      console.error("Failed to load subscription:", err)
    } finally {
      setLoading(false)
    }
  }

  async function subscribe(planKey: string) {
    try {
      // Create checkout session
      const checkoutRes = await fetch(
        `${API_BASE}/billing/checkout/create-session?` + 
        new URLSearchParams({
          customer_id: customerId.toString(),
          plan_key: planKey,
          billing_cycle: billingCycle,
          success_url: `${window.location.origin}/settings/billing?success=true`,
          cancel_url: `${window.location.origin}/settings/billing?canceled=true`,
        }),
        { method: "POST" }
      )

      if (checkoutRes.ok) {
        const data = await checkoutRes.json()
        // Redirect to Stripe checkout
        window.location.href = data.url
      }
    } catch (err) {
      console.error("Failed to create checkout:", err)
      alert("Failed to start checkout. Please try again.")
    }
  }

  async function manageBilling() {
    try {
      const res = await fetch(
        `${API_BASE}/billing/portal/create-session?` +
        new URLSearchParams({
          customer_id: customerId.toString(),
          return_url: window.location.href,
        }),
        { method: "POST" }
      )

      if (res.ok) {
        const data = await res.json()
        window.location.href = data.url
      }
    } catch (err) {
      console.error("Failed to open portal:", err)
    }
  }

  const getPrice = (plan: SubscriptionPlan) => {
    return billingCycle === "monthly" ? plan.price_monthly : plan.price_yearly
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-blue-400" />
          Billing & Subscriptions
        </h1>
        <p className="text-sm text-neutral-400">
          Manage your subscription and billing information
        </p>
      </header>

      {/* Current Subscription */}
      {subscription && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Current Subscription</h3>
              <p className="text-sm text-neutral-400">
                Status: <span className="text-emerald-400 capitalize">{subscription.status}</span>
              </p>
            </div>
            <Button onClick={manageBilling} variant="outline">
              <ExternalLink className="w-4 h-4 mr-2" />
              Manage Billing
            </Button>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-neutral-500">Current Period</p>
              <p className="text-sm text-white">
                {new Date(subscription.current_period_start).toLocaleDateString()} -{" "}
                {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Renewal</p>
              <p className="text-sm text-white">
                {subscription.cancel_at_period_end ? (
                  <span className="text-amber-400">Cancels at period end</span>
                ) : (
                  <span className="text-emerald-400">Auto-renews</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Billing Cycle Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-neutral-800 bg-neutral-900/50 p-1">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              billingCycle === "monthly"
                ? "bg-blue-600 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              billingCycle === "yearly"
                ? "bg-blue-600 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Yearly <span className="text-emerald-400 ml-1">(Save 20%)</span>
          </button>
        </div>
      </div>

      {/* Subscription Plans */}
      {loading ? (
        <p className="text-center text-neutral-400 py-12">Loading plans...</p>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const price = getPrice(plan)
            const isCurrentPlan = subscription?.plan_id === plan.id

            return (
              <div
                key={plan.id}
                className={`rounded-lg border p-6 ${
                  plan.tier === "professional"
                    ? "border-blue-500 bg-blue-950/20"
                    : "border-neutral-800 bg-neutral-900/50"
                }`}
              >
                {plan.tier === "professional" && (
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold text-blue-400 uppercase">
                      Most Popular
                    </span>
                  </div>
                )}

                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-sm text-neutral-400 mb-4">{plan.description}</p>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">
                    ${price?.toFixed(0) || 0}
                  </span>
                  <span className="text-neutral-400 ml-2">
                    /{billingCycle === "monthly" ? "mo" : "yr"}
                  </span>
                </div>

                <Button
                  onClick={() => subscribe(plan.plan_key)}
                  disabled={isCurrentPlan}
                  className={`w-full mb-6 ${
                    plan.tier === "professional"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : ""
                  }`}
                >
                  {isCurrentPlan ? "Current Plan" : "Subscribe"}
                </Button>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-neutral-300 uppercase">
                    Features
                  </p>
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-neutral-300">{feature}</span>
                    </div>
                  ))}
                </div>

                {Object.keys(plan.limits).length > 0 && (
                  <div className="mt-6 pt-6 border-t border-neutral-800">
                    <p className="text-xs font-semibold text-neutral-300 uppercase mb-3">
                      Limits
                    </p>
                    {Object.entries(plan.limits).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm mb-2">
                        <span className="text-neutral-400 capitalize">
                          {key.replace("_", " ")}
                        </span>
                        <span className="text-white font-semibold">
                          {value === -1 ? "Unlimited" : value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Usage Section */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          Usage This Month
        </h3>
        <div className="grid md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">0</p>
            <p className="text-xs text-neutral-500">Jobs Created</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">0</p>
            <p className="text-xs text-neutral-500">Quotes Sent</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">0 GB</p>
            <p className="text-xs text-neutral-500">Storage Used</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">0</p>
            <p className="text-xs text-neutral-500">API Calls</p>
          </div>
        </div>
      </div>
    </div>
  )
}
