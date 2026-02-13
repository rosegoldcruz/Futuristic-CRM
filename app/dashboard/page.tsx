// app/dashboard/page.tsx
"use client";

import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { BarChart3, Briefcase, Users, Wallet } from "lucide-react";

const jobFunnel = [
  { label: "Requests", value: 120 },
  { label: "Qualified", value: 80 },
  { label: "Bid Sent", value: 54 },
  { label: "Won", value: 31 },
];

const jobMix = [
  { label: "Cabinets", value: 44 },
  { label: "Paneling", value: 21 },
  { label: "Flooring", value: 17 },
  { label: "Other", value: 18 },
];

const colors = ["#FF7A18", "#FFB878", "#00E0FF", "#B7B7C9"];

export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* KPI row */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
        <KpiCard
          label="Total Jobs"
          value="312"
          delta="+18 this week"
          icon={<Briefcase className="h-5 w-5" />}
        />
        <KpiCard
          label="Total Revenue"
          value="$842,190"
          delta="+23% vs last month"
          icon={<Wallet className="h-5 w-5" />}
        />
        <KpiCard
          label="Jobs Completed"
          value="274"
          delta="87.8% completion rate"
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <KpiCard
          label="Active Contractors"
          value="42"
          delta="5 new onboarded"
          icon={<Users className="h-5 w-5" />}
        />
      </section>

      {/* "Charts" row – pure CSS bars, zero external libs */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-5 items-stretch">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-textPrimary">
              Jobs & Revenue (Dummy Data)
            </h2>
            <span className="text-[11px] text-textSecondary/80">
              Static preview – wire real metrics later
            </span>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-2 items-end h-40">
            {[12, 18, 22, 17, 26, 9, 5].map((jobs, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1">
                <div className="w-full flex-1 bg-surfaceSoft rounded-full overflow-hidden border border-borderSubtle/80">
                  <div
                    className="w-full bg-gradient-to-t from-accent to-accentBlue"
                    style={{ height: `${(jobs / 26) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-textSecondary/80">
                  {"MTWThFSu".split("")[idx]}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-textPrimary">Job Funnel</h2>
            <span className="text-[11px] text-textSecondary/80">
              Conversion pipeline
            </span>
          </div>
          <div className="space-y-3 mt-2">
            {jobFunnel.map((step, idx) => (
              <div key={step.label} className="flex items-center gap-3">
                <div className="w-20 text-[11px] text-textSecondary/80">
                  {step.label}
                </div>
                <div className="flex-1 h-3 rounded-full bg-surfaceSoft border border-borderSubtle/70 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-accentBlue"
                    style={{
                      width: `${(step.value / jobFunnel[0].value) * 100}%`,
                    }}
                  />
                </div>
                <div className="w-10 text-[11px] text-textSecondary/80 text-right">
                  {step.value}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-textPrimary">
              Job Mix by Trade
            </h2>
            <span className="text-[11px] text-textSecondary/80">
              Static – replace with real breakdown
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {jobMix.map((item, idx) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: colors[idx] }}
                  />
                  <span className="text-xs text-textPrimary/90">
                    {item.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 rounded-full bg-surfaceSoft overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(item.value / 44) * 100}%`,
                        backgroundColor: colors[idx],
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-textSecondary/80">
                    {item.value}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-textPrimary">
              AI Activity Feed
            </h2>
            <span className="text-[11px] text-textSecondary/80">
              Last 10 events
            </span>
          </div>
          <div className="space-y-3 text-xs md:text-[13px] max-h-56 overflow-y-auto scrollbar-thin">
            {[
              "Generated scope for 14-door shaker kitchen in Phoenix.",
              "Estimated materials for paneling job in Scottsdale.",
              "Built contract for flooring refinish in Chandler.",
              "Repriced materials for white shaker set in Mesa.",
              "Optimized labor pricing for 3-bath refacing project.",
            ].map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-lg bg-surfaceSoft/80 border border-borderSubtle px-3 py-2"
              >
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" />
                <div>
                  <p className="text-textPrimary/90">{item}</p>
                  <p className="text-[11px] text-textSecondary/80 mt-1">
                    AI • Vulpine Marketplace OS
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-textPrimary">
              Material Cost Watchlist
            </h2>
            <span className="text-[11px] text-textSecondary/80">
              Key SKUs this week
            </span>
          </div>
          <div className="space-y-2 text-xs md:text-[13px]">
            {[
              {
                label: "RTA Shaker Door Set • Arctic White",
                delta: "+3.2%",
                direction: "up",
              },
              {
                label: "Premium Paneling Bundle • Smoke Oak",
                delta: "-1.1%",
                direction: "down",
              },
              {
                label: "Soft-close Hinge Pack • 20ct",
                delta: "+0.4%",
                direction: "up",
              },
              {
                label: "Quartz Countertop Slab • Calacatta",
                delta: "+4.7%",
                direction: "up",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg bg-surfaceSoft/80 border border-borderSubtle px-3 py-2"
              >
                <span className="text-textPrimary/90">{item.label}</span>
                <span
                  className={
                    "text-[11px] px-2 py-0.5 rounded-full " +
                    (item.direction === "up"
                      ? "bg-emerald-400/10 text-emerald-300 border border-emerald-400/40"
                      : "bg-sky-400/10 text-sky-300 border border-sky-400/40")
                  }
                >
                  {item.delta}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
