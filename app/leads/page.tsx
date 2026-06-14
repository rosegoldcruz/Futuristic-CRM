import Link from "next/link";
import { Download } from "lucide-react";
import { requireActiveUser } from "@/lib/auth/access";
import { getPrisma } from "@/lib/prisma";
import { INTEREST_LEVELS, LEAD_STATUSES, listLeads } from "@/lib/leads";
import {
  addLeadNoteAction,
  archiveLeadAction,
  assignLeadAction,
  convertLeadAction,
  createLeadAction,
  updateLeadAction,
  updateLeadStatusAction,
} from "@/lib/leads/actions";
import { StatefulForm } from "@/components/mail/form-state";
import { Badge, Field, MailShell, Panel, inputClass, textAreaClass } from "@/components/mail/ui";
import { Button } from "@/components/ui/button";

function nameFor(lead: { first_name: string | null; last_name: string | null; email: string | null }) {
  return [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.email || "Unnamed lead";
}

function badgeTone(value: string) {
  if (value === "hot" || value === "won" || value === "qualified") return "green";
  if (value === "lost" || value === "do_not_contact") return "red";
  if (value === "warm" || value === "follow_up" || value === "proposal_needed") return "yellow";
  return "cyan";
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string; interest?: string; source?: string };
}) {
  const user = await requireActiveUser();
  const q = searchParams?.q ?? "";
  const status = searchParams?.status ?? "";
  const interest = searchParams?.interest ?? "";
  const source = searchParams?.source ?? "";
  const [leads, sources] = await Promise.all([
    listLeads({ search: q, status, interestLevel: interest, source, limit: 150 }),
    getPrisma().$queryRaw<Array<{ source: string }>>`
      SELECT DISTINCT source FROM leads WHERE source IS NOT NULL AND archived_at IS NULL ORDER BY source
    `,
  ]);

  return (
    <MailShell user={user} title="Leads">
      <Panel title="Filters">
        <form className="grid gap-3 md:grid-cols-[1fr_190px_180px_190px_120px]">
          <input name="q" defaultValue={q} placeholder="Search name, email, phone, company" className={inputClass()} />
          <select name="status" defaultValue={status} className={inputClass()}>
            <option value="">Any status</option>
            {LEAD_STATUSES.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select name="interest" defaultValue={interest} className={inputClass()}>
            <option value="">Any interest</option>
            {INTEREST_LEVELS.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select name="source" defaultValue={source} className={inputClass()}>
            <option value="">Any source</option>
            {sources.map((item) => <option key={item.source}>{item.source}</option>)}
          </select>
          <Button type="submit">Filter</Button>
        </form>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Panel title="Create Lead">
          <StatefulForm action={createLeadAction} submitLabel="Create Lead">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="First Name"><input name="firstName" className={inputClass()} /></Field>
              <Field label="Last Name"><input name="lastName" className={inputClass()} /></Field>
              <Field label="Email"><input name="email" type="email" className={inputClass()} /></Field>
              <Field label="Phone"><input name="phone" className={inputClass()} /></Field>
              <Field label="Company"><input name="companyName" className={inputClass()} /></Field>
              <Field label="Title"><input name="title" className={inputClass()} /></Field>
              <Field label="Source"><input name="source" className={inputClass()} /></Field>
              <Field label="Campaign"><input name="campaign" className={inputClass()} /></Field>
              <Field label="Status"><select name="status" defaultValue="new" className={inputClass()}>{LEAD_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Interest"><select name="interestLevel" defaultValue="unknown" className={inputClass()}>{INTEREST_LEVELS.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Assigned To"><input name="assignedTo" className={inputClass()} /></Field>
              <Field label="Next Follow-Up"><input name="nextFollowUpAt" type="datetime-local" className={inputClass()} /></Field>
            </div>
            <Field label="Notes"><textarea name="notes" className={textAreaClass()} /></Field>
          </StatefulForm>
        </Panel>

        <Panel title="Exports">
          <div className="space-y-3">
            <Link href="/api/leads/exports/leads" className="flex h-10 items-center justify-between border border-borderSubtle bg-bgDark px-3 font-display text-xs uppercase text-textPrimary hover:border-cyber-cyan hover:text-cyber-cyan">
              Leads CSV <Download className="h-4 w-4" />
            </Link>
            <Link href="/api/leads/exports/events" className="flex h-10 items-center justify-between border border-borderSubtle bg-bgDark px-3 font-display text-xs uppercase text-textPrimary hover:border-cyber-cyan hover:text-cyber-cyan">
              Lead Events CSV <Download className="h-4 w-4" />
            </Link>
            <div className="border border-borderSubtle bg-bgDark p-3 text-xs text-textSecondary">
              CSV import is intentionally disabled until lead-file profiling confirms safe field mappings.
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Lead Pipeline">
        <div className="space-y-4">
          {leads.map((lead) => (
            <div key={lead.id} className="border border-borderSubtle bg-bgDark p-4">
              <div className="grid gap-3 text-xs xl:grid-cols-[1.2fr_1fr_1fr_120px_120px_1fr]">
                <div>
                  <p className="font-display text-sm uppercase text-textPrimary">{nameFor(lead)}</p>
                  <p className="text-textSecondary">{lead.email ?? "No email"} | {lead.phone ?? "No phone"}</p>
                </div>
                <div>
                  <p className="text-textPrimary">{lead.company_name ?? lead.linked_company_name ?? "No company"}</p>
                  <p className="text-textSecondary">{lead.title ?? "No title"}</p>
                </div>
                <div>
                  <p className="text-textSecondary">Source: {lead.source ?? "none"}</p>
                  <p className="text-textSecondary">Campaign: {lead.campaign ?? "none"}</p>
                </div>
                <Badge tone={badgeTone(lead.status)}>{lead.status}</Badge>
                <Badge tone={badgeTone(lead.interest_level)}>{lead.interest_level}</Badge>
                <div className="text-textSecondary">
                  <p>Assigned: {lead.assigned_to ?? "none"}</p>
                  <p>Follow-up: {lead.next_follow_up_at?.toLocaleString() ?? "none"}</p>
                  <p>Created: {lead.created_at.toLocaleDateString()}</p>
                  <p>{lead.contact_id ? "Linked contact" : "No linked contact"} | {lead.company_id ? "Linked company" : "No linked company"}</p>
                </div>
              </div>

              <form action={updateLeadAction} className="mt-4 grid gap-2 md:grid-cols-4">
                <input type="hidden" name="id" value={lead.id} />
                <input name="firstName" defaultValue={lead.first_name ?? ""} className={inputClass()} />
                <input name="lastName" defaultValue={lead.last_name ?? ""} className={inputClass()} />
                <input name="email" defaultValue={lead.email ?? ""} className={inputClass()} />
                <input name="phone" defaultValue={lead.phone ?? ""} className={inputClass()} />
                <input name="companyName" defaultValue={lead.company_name ?? ""} className={inputClass()} />
                <input name="title" defaultValue={lead.title ?? ""} className={inputClass()} />
                <input name="source" defaultValue={lead.source ?? ""} className={inputClass()} />
                <input name="campaign" defaultValue={lead.campaign ?? ""} className={inputClass()} />
                <select name="status" defaultValue={lead.status} className={inputClass()}>{LEAD_STATUSES.map((item) => <option key={item}>{item}</option>)}</select>
                <select name="interestLevel" defaultValue={lead.interest_level} className={inputClass()}>{INTEREST_LEVELS.map((item) => <option key={item}>{item}</option>)}</select>
                <input name="assignedTo" defaultValue={lead.assigned_to ?? ""} className={inputClass()} />
                <input name="estimatedValue" defaultValue={lead.estimated_value ?? ""} className={inputClass()} />
                <input name="nextFollowUpAt" type="datetime-local" className={inputClass()} />
                <input name="notes" defaultValue={lead.notes ?? ""} className={inputClass()} />
                <Button type="submit" size="sm">Save</Button>
              </form>

              <div className="mt-3 flex flex-wrap gap-2">
                {LEAD_STATUSES.map((item) => (
                  <form key={item} action={updateLeadStatusAction}>
                    <input type="hidden" name="id" value={lead.id} />
                    <input type="hidden" name="status" value={item} />
                    <Button type="submit" size="sm" variant={item === lead.status ? "secondary" : "ghost"} disabled={item === lead.status}>{item}</Button>
                  </form>
                ))}
              </div>

              <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_1fr_160px_120px]">
                <form action={assignLeadAction} className="flex gap-2">
                  <input type="hidden" name="id" value={lead.id} />
                  <input name="assignedTo" placeholder="owner@vulpinehomes.com" className={inputClass()} />
                  <Button type="submit" size="sm">Assign</Button>
                </form>
                <form action={addLeadNoteAction} className="flex gap-2">
                  <input type="hidden" name="id" value={lead.id} />
                  <input name="body" placeholder="Add note" className={inputClass()} />
                  <Button type="submit" size="sm">Note</Button>
                </form>
                <form action={convertLeadAction}>
                  <input type="hidden" name="id" value={lead.id} />
                  <Button type="submit" size="sm" variant="yellow" disabled={!lead.email}>Convert</Button>
                </form>
                <form action={archiveLeadAction}>
                  <input type="hidden" name="id" value={lead.id} />
                  <Button type="submit" size="sm" variant="destructive">Archive</Button>
                </form>
              </div>
            </div>
          ))}
          {leads.length === 0 && (
            <div className="border border-borderSubtle bg-bgDark p-5 text-sm text-textSecondary">
              No leads match this view. Use the create form above to add the first real lead.
            </div>
          )}
        </div>
      </Panel>
    </MailShell>
  );
}
