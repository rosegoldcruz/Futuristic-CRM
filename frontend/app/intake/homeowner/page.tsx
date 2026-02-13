"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type ScopeLineItem = {
  code: string;
  label: string;
  qty: number;
  unit: string;
  unit_price: number;
  total_price: number;
  notes?: string | null;
};

type AIScopeResult = {
  scope_summary: string;
  line_items: ScopeLineItem[];
  suggested_contract_low: number;
  suggested_contract_high: number;
  estimated_duration_weeks: number;
  risk_flags: string[];
};

type IntakeFile = {
  filename: string;
  url: string;
};

type HomeownerIntakeResponse = {
  homeowner: {
    full_name: string;
    email: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    postal_code: string;
  };
  measurements: {
    linear_feet_cabinets: number;
    ceiling_height_inches: number;
    layout_type: string;
    has_island: boolean;
    appliance_notes?: string | null;
  };
  context: {
    existing_finish?: string | null;
    desired_finish?: string | null;
    doors_drawers_plan?: string | null;
    timeline_weeks?: number | null;
    budget_low?: number | null;
    budget_high?: number | null;
    notes?: string | null;
  };
  files: IntakeFile[];
  ai_scope: AIScopeResult;
};

export default function HomeownerIntakePage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const [linearFeet, setLinearFeet] = useState<string>("");
  const [ceilingHeight, setCeilingHeight] = useState<string>("");
  const [layoutType, setLayoutType] = useState("L-Shape");
  const [hasIsland, setHasIsland] = useState(false);
  const [applianceNotes, setApplianceNotes] = useState("");

  const [existingFinish, setExistingFinish] = useState("");
  const [desiredFinish, setDesiredFinish] = useState("");
  const [doorsDrawersPlan, setDoorsDrawersPlan] = useState("");
  const [timelineWeeks, setTimelineWeeks] = useState<string>("");
  const [budgetLow, setBudgetLow] = useState<string>("");
  const [budgetHigh, setBudgetHigh] = useState<string>("");
  const [notes, setNotes] = useState("");

  const [photos, setPhotos] = useState<File[]>([]);
  const [result, setResult] = useState<HomeownerIntakeResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFilesChange = (files: FileList | null) => {
    if (!files) {
      setPhotos([]);
      return;
    }
    setPhotos(Array.from(files));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();

      // Homeowner
      formData.append("full_name", fullName);
      formData.append("email", email);
      formData.append("phone", phone);
      formData.append("street", street);
      formData.append("city", city);
      formData.append("state", stateVal);
      formData.append("postal_code", postalCode);

      // Measurements
      formData.append("linear_feet_cabinets", linearFeet || "0");
      formData.append("ceiling_height_inches", ceilingHeight || "0");
      formData.append("layout_type", layoutType);
      formData.append("has_island", hasIsland ? "true" : "false");
      if (applianceNotes) {
        formData.append("appliance_notes", applianceNotes);
      }

      // Context
      if (existingFinish) formData.append("existing_finish", existingFinish);
      if (desiredFinish) formData.append("desired_finish", desiredFinish);
      if (doorsDrawersPlan)
        formData.append("doors_drawers_plan", doorsDrawersPlan);
      if (timelineWeeks)
        formData.append("timeline_weeks", timelineWeeks || "0");
      if (budgetLow) formData.append("budget_low", budgetLow || "0");
      if (budgetHigh) formData.append("budget_high", budgetHigh || "0");
      if (notes) formData.append("notes", notes);

      // Photos
      photos.forEach((file) => {
        formData.append("photos", file);
      });

      const res = await fetch(`${API_BASE_URL}/intake/homeowner`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Intake failed (${res.status}): ${text || res.statusText}`
        );
      }

      const data = (await res.json()) as HomeownerIntakeResponse;
      setResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Intake failed";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const money = (v: number | null | undefined) =>
    typeof v === "number" && !Number.isNaN(v)
      ? `$${v.toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })}`
      : "-";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-textPrimary">
          Homeowner Intake
        </h1>
        <p className="text-sm text-textSecondary max-w-3xl">
          Drop a homeowner into Vulpine, attach photos + rough measurements, and
          let AEON generate a scoped, priced refacing job and quote seed.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Left: Intake form */}
        <Card>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Contact */}
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-textPrimary">
                Homeowner Contact
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-textSecondary">
                    Full Name
                  </label>
                  <input
                    className="w-full rounded-md border border-borderSubtle bg-bgElevated px-3 py-2 text-sm text-textPrimary outline-none focus:ring-1 focus:ring-accent"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-textSecondary">Email</label>
                  <input
                    type="email"
                    className="w-full rounded-md border border-borderSubtle bg-bgElevated px-3 py-2 text-sm text-textPrimary outline-none focus:ring-1 focus:ring-accent"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-textSecondary">Phone</label>
                  <input
                    className="w-full rounded-md border border-borderSubtle bg-bgElevated px-3 py-2 text-sm text-textPrimary outline-none focus:ring-1 focus:ring-accent"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs text-textSecondary">Street</label>
                  <input
                    className="w-full rounded-md border border-borderSubtle bg-bgElevated px-3 py-2 text-sm text-textPrimary outline-none focus:ring-1 focus:ring-accent"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-textSecondary">City</label>
                  <input
                    className="w-full rounded-md border border-borderSubtle bg-bgElevated px-3 py-2 text-sm text-textPrimary outline-none focus:ring-1 focus:ring-accent"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-textSecondary">State</label>
                    <input
                      className="w-full rounded-md border border-borderSubtle bg-bgElevated px-3 py-2 text-sm text-textPrimary outline-none focus:ring-1 focus:ring-accent"
                      value={stateVal}
                      onChange={(e) => setStateVal(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-textSecondary">
                      ZIP Code
                    </label>
                    <input
                      className="w-full rounded-md border border-borderSubtle bg-bgElevated px-3 py-2 text-sm text-textPrimary outline-none focus:ring-1 focus:ring-accent"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Measurements */}
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-textPrimary">
                Kitchen Measurements
              </h2>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs text-textSecondary">
                    Linear Feet of Cabinets
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full rounded-md border border-borderSubtle bg-bgElevated px-3 py-2 text-sm text-textPrimary outline-none focus:ring-1 focus:ring-accent"
                    value={linearFeet}
                    onChange={(e) => setLinearFeet(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-textSecondary">
                    Ceiling Height (inches)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-md border border-borderSubtle bg-bgElevated px-3 py-2 text-sm text-textPrimary outline-none focus:ring-1 focus:ring-accent"
                    value={ceilingHeight}
                    onChange={(e) => setCeilingHeight(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-textSecondary">
                    Layout Type
                  </label>
                  <select
                    className="w-full rounded-md border border-borderSubtle bg-bgElevated px-3 py-2 text-sm text-textPrimary outline-none focus:ring-1 focus:ring-accent"
                    value={layoutType}
                    onChange={(e) => setLayoutType(e.target.value)}
                  >
                    <option value="L-Shape">L-Shape</option>
                    <option value="U-Shape">U-Shape</option>
                    <option value="Galley">Galley</option>
                    <option value="Island">Island</option>
                    <option value="Open-Concept">Open Concept</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="inline-flex items-center gap-2 text-xs text-textSecondary">
                  <input
                    type="checkbox"
                    checked={hasIsland}
                    onChange={(e) => setHasIsland(e.target.checked)}
                    className="h-3 w-3 rounded border-borderSubtle bg-bgElevated text-accent focus:ring-accent"
                  />
                  Includes island cabinetry
                </label>
                <div className="space-y-1">
                  <label className="text-xs text-textSecondary">
                    Appliance / layout notes
                  </label>
                  <input
                    className="w-full rounded-md border border-borderSubtle bg-bgElevated px-3 py-2 text-sm text-textPrimary outline-none focus:ring-1 focus:ring-accent"
                    value={applianceNotes}
                    onChange={(e) => setApplianceNotes(e.target.value)}
                    placeholder="Double ovens, built-in fridge, etc."
                  />
                </div>
              </div>
            </div>

            {/* Context */}
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-textPrimary">
                Finish, Budget & Timing
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-textSecondary">
                    Existing Finish
                  </label>
                  <input
                    className="w-full rounded-md border border-borderSubtle bg-bgElevated px-3 py-2 text-sm text-textPrimary outline-none focus:ring-1 focus:ring-accent"
                    value={existingFinish}
                    onChange={(e) => setExistingFinish(e.target.value)}
                    placeholder="Honey oak, painted white, espresso..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-textSecondary">
                    Desired Finish
                  </label>
                  <input
                    className="w-full rounded-md border border-borderSubtle bg-bgElevated px-3 py-2 text-sm text-textPrimary outline-none focus:ring-1 focus:ring-accent"
                    value={desiredFinish}
                    onChange={(e) => setDesiredFinish(e.target.value)}
                    placeholder="Shaker white, 2-tone, rift oak..."
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-textSecondary">
                  Doors / drawers plan
                </label>
                <input
                  className="w-full rounded-md border border-borderSubtle bg-bgElevated px-3 py-2 text-sm text-textPrimary outline-none focus:ring-1 focus:ring-accent"
                  value={doorsDrawersPlan}
                  onChange={(e) => setDoorsDrawersPlan(e.target.value)}
                  placeholder="Keep layout, add drawers, extend uppers, etc."
                />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs text-textSecondary">
                    Timeline (weeks)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-md border border-borderSubtle bg-bgElevated px-3 py-2 text-sm text-textPrimary outline-none focus:ring-1 focus:ring-accent"
                    value={timelineWeeks}
                    onChange={(e) => setTimelineWeeks(e.target.value)}
                    placeholder="e.g. 4"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-textSecondary">
                    Budget min ($)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-md border border-borderSubtle bg-bgElevated px-3 py-2 text-sm text-textPrimary outline-none focus:ring-1 focus:ring-accent"
                    value={budgetLow}
                    onChange={(e) => setBudgetLow(e.target.value)}
                    placeholder="e.g. 8000"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-textSecondary">
                    Budget max ($)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-md border border-borderSubtle bg-bgElevated px-3 py-2 text-sm text-textPrimary outline-none focus:ring-1 focus:ring-accent"
                    value={budgetHigh}
                    onChange={(e) => setBudgetHigh(e.target.value)}
                    placeholder="e.g. 15000"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-textSecondary">
                  Extra notes / constraints
                </label>
                <textarea
                  className="w-full min-h-[70px] rounded-md border border-borderSubtle bg-bgElevated px-3 py-2 text-sm text-textPrimary outline-none focus:ring-1 focus:ring-accent"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Access issues, pets, must-keep elements, etc."
                />
              </div>
            </div>

            {/* Photos */}
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-textPrimary">
                Photos (optional but recommended)
              </h2>
              <div className="space-y-2">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleFilesChange(e.target.files)}
                  className="block w-full text-xs text-textSecondary file:mr-3 file:rounded-md file:border-0 file:bg-accent/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent hover:file:bg-accent/20"
                />
                {photos.length > 0 && (
                  <p className="text-[11px] text-textSecondary/80">
                    {photos.length} file(s) attached
                  </p>
                )}
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-between gap-3 pt-2">
              {error && (
                <span className="text-[11px] text-red-400">{error}</span>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="ml-auto inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-medium uppercase tracking-wide text-black hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Running scope…" : "Generate AEON Scope"}
              </button>
            </div>
          </form>
        </Card>

        {/* Right: AI output */}
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <KpiCard
              label="Suggested Contract"
              value={
                result
                  ? `${money(
                      result.ai_scope.suggested_contract_low
                    )} – ${money(result.ai_scope.suggested_contract_high)}`
                  : "Awaiting intake"
              }
              delta={result ? "AI refacing band" : undefined}
            />
            <KpiCard
              label="Estimated Duration"
              value={
                result?.ai_scope.estimated_duration_weeks
                  ? `${result.ai_scope.estimated_duration_weeks} weeks`
                  : "—"
              }
            />
          </div>

          <Card>
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-textPrimary">
                Scope Summary
              </h2>
              <p className="text-sm text-textSecondary">
                {result?.ai_scope.scope_summary ||
                  "Run an intake to generate a scoped refacing plan with line items, pricing band, and flags."}
              </p>
            </div>
          </Card>

          <Card>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-textPrimary">
                  Line Items
                </h2>
                <span className="text-[11px] text-textSecondary">
                  {result?.ai_scope.line_items.length || 0} items
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto rounded-md border border-borderSubtle">
                <table className="min-w-full divide-y divide-borderSubtle text-xs">
                  <thead className="bg-bgElevated/80">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-textSecondary">
                        Item
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-textSecondary">
                        Qty
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-textSecondary">
                        Unit
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-textSecondary">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borderSubtle bg-bgElevated/60">
                    {result?.ai_scope.line_items.map((item) => (
                      <tr key={`${item.code}-${item.label}`}>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-textPrimary">
                              {item.label}
                            </span>
                            {item.notes && (
                              <span className="text-[11px] text-textSecondary">
                                {item.notes}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-textSecondary">
                          {item.qty}
                        </td>
                        <td className="px-3 py-2 text-right text-textSecondary">
                          {item.unit}
                        </td>
                        <td className="px-3 py-2 text-right text-textPrimary">
                          {money(item.total_price)}
                        </td>
                      </tr>
                    ))}

                    {!result && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-6 text-center text-[11px] text-textSecondary"
                        >
                          Scope line items will appear here after AI intake.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          {result?.ai_scope.risk_flags?.length ? (
            <Card>
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-textPrimary">
                  Risk Flags
                </h2>
                <div className="flex flex-wrap gap-2">
                  {result.ai_scope.risk_flags.map((flag) => (
                    <span
                      key={flag}
                      className="inline-flex items-center rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-[11px] text-red-200"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
