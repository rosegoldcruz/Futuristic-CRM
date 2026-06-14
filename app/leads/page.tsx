import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import { requireActiveUser } from "@/lib/auth/access";
import { getPrisma } from "@/lib/prisma";
import { countLeads, INTEREST_LEVELS, LEAD_STATUSES, listLeads } from "@/lib/leads";
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

type SearchParams = Record<string, string | string[] | undefined>;

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const SORT_KEYS = ["name", "company", "phone", "email", "status", "source", "assignedTo", "estimatedValue", "lastContactedAt", "createdAt", "updatedAt"];

function param(searchParams: SearchParams | undefined, key: string) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function numberParam(searchParams: SearchParams | undefined, key: string, fallback: number) {
  const parsed = Number(param(searchParams, key));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pageSizeParam(searchParams: SearchParams | undefined) {
  const size = numberParam(searchParams, "pageSize", 25);
  return PAGE_SIZE_OPTIONS.includes(size) ? size : 25;
}

function nameFor(lead: { first_name: string | null; last_name: string | null; email: string | null }) {
  return [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.email || "Unnamed lead";
}

function badgeTone(value: string) {
  if (value === "hot" || value === "won" || value === "qualified") return "green";
  if (value === "lost" || value === "do_not_contact") return "red";
  if (value === "warm" || value === "follow_up" || value === "proposal_needed") return "yellow";
  return "cyan";
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "none";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "none";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function buildHref(searchParams: SearchParams | undefined, updates: Record<string, string | number | null>) {
  const next = new URLSearchParams();
  for (const [key, raw] of Object.entries(searchParams ?? {})) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) next.set(key, value);
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  const query = next.toString();
  return query ? `/leads?${query}` : "/leads";
}

function SortHeader({ label, sortKey, currentSort, currentDir, searchParams }: { label: string; sortKey: string; currentSort: string; currentDir: string; searchParams?: SearchParams }) {
  const active = currentSort === sortKey;
  const nextDir = active && currentDir === "asc" ? "desc" : "asc";
  const Icon = active ? (currentDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <Link href={buildHref(searchParams, { sort: sortKey, dir: nextDir, page: 1 })} className="inline-flex items-center gap-1 text-textSecondary hover:text-cyber-cyan">
      {label}
      <Icon className="h-3 w-3" />
    </Link>
  );
}

export default async function LeadsPage({ searchParams }: { searchParams?: SearchParams }) {
  const user = await requireActiveUser();
  const q = param(searchParams, "q");
  const status = param(searchParams, "status");
  const interest = param(searchParams, "interest");
  const source = param(searchParams, "source");
  const assignedTo = param(searchParams, "assignedTo");
  const selectedId = param(searchParams, "selected");
  const page = numberParam(searchParams, "page", 1);
  const pageSize = pageSizeParam(searchParams);
  const requestedSort = param(searchParams, "sort") || "createdAt";
  const sort = SORT_KEYS.includes(requestedSort) ? requestedSort : "createdAt";
  const dir = param(searchParams, "dir") === "asc" ? "asc" : "desc";
  const offset = (page - 1) * pageSize;

  const filters = { search: q, status, interestLevel: interest, source, assignedTo, limit: pageSize, offset, sort, dir };
  const [leads, total, sources, assignees] = await Promise.all([
    listLeads(filters),
    countLeads(filters),
    getPrisma().$queryRaw<Array<{ source: string }>>`SELECT DISTINCT source FROM leads WHERE source IS NOT NULL AND archived_at IS NULL ORDER BY source`,
    getPrisma().$queryRaw<Array<{ assigned_to: string }>>`SELECT DISTINCT assigned_to FROM leads WHERE assigned_to IS NOT NULL AND archived_at IS NULL ORDER BY assigned_to`,
  ]);
  const selectedLead = selectedId ? leads.find((lead) => lead.id === selectedId) ?? null : null;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <MailShell user={user} title="Leads">
      <Panel title="Lead Records">
        <form className="mb-4 grid gap-3 lg:grid-cols-[1fr_150px_150px_170px_190px_100px]">
          <input name="q" defaultValue={q} placeholder="Search name, email, phone, company, notes" className={inputClass()} />
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
          <select name="assignedTo" defaultValue={assignedTo} className={inputClass()}>
            <option value="">Any assignee</option>
            {assignees.map((item) => <option key={item.assigned_to}>{item.assigned_to}</option>)}
          </select>
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
          <input type="hidden" name="pageSize" value={pageSize} />
          <Button type="submit">Search</Button>
        </form>

        <div className="overflow-x-auto border border-borderSubtle">
          <table className="min-w-[1180px] w-full border-collapse text-left text-xs">
            <thead className="bg-bgDark text-[10px] uppercase tracking-wider">
              <tr className="border-b border-borderSubtle">
                <th className="px-3 py-2"><SortHeader label="Lead Name" sortKey="name" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2"><SortHeader label="Company" sortKey="company" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2"><SortHeader label="Phone" sortKey="phone" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2"><SortHeader label="Email" sortKey="email" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2"><SortHeader label="Status" sortKey="status" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2"><SortHeader label="Source" sortKey="source" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2"><SortHeader label="Assigned" sortKey="assignedTo" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2"><SortHeader label="Value" sortKey="estimatedValue" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2"><SortHeader label="Last Contact" sortKey="lastContactedAt" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2"><SortHeader label="Created" sortKey="createdAt" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2"><SortHeader label="Updated" sortKey="updatedAt" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2 text-textSecondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className={`border-b border-borderSubtle bg-bgDark/60 hover:bg-surface ${lead.id === selectedId ? "outline outline-1 outline-cyber-cyan" : ""}`}>
                  <td className="px-3 py-2 font-medium text-textPrimary">{nameFor(lead)}</td>
                  <td className="px-3 py-2 text-textSecondary">{lead.company_name ?? lead.linked_company_name ?? "none"}</td>
                  <td className="px-3 py-2 text-textSecondary">{lead.phone ?? "none"}</td>
                  <td className="px-3 py-2 text-textSecondary">{lead.email ?? "none"}</td>
                  <td className="px-3 py-2"><Badge tone={badgeTone(lead.status)}>{lead.status}</Badge></td>
                  <td className="px-3 py-2 text-textSecondary">{lead.source ?? "none"}</td>
                  <td className="px-3 py-2 text-textSecondary">{lead.assigned_to ?? "none"}</td>
                  <td className="px-3 py-2 text-textSecondary">{lead.estimated_value ?? "none"}</td>
                  <td className="px-3 py-2 text-textSecondary">{formatDate(lead.last_contacted_at)}</td>
                  <td className="px-3 py-2 text-textSecondary">{formatDate(lead.created_at)}</td>
                  <td className="px-3 py-2 text-textSecondary">{formatDate(lead.updated_at)}</td>
                  <td className="px-3 py-2">
                    <Link href={buildHref(searchParams, { selected: lead.id })} className="font-display text-[10px] uppercase tracking-wider text-cyber-cyan hover:text-cyber-green">
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-5 text-center text-sm text-textSecondary">No leads match this view.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-textSecondary">
          <p>Showing {leads.length ? offset + 1 : 0}-{Math.min(offset + leads.length, total)} of {total}</p>
          <div className="flex items-center gap-2">
            <Link href={buildHref(searchParams, { page: Math.max(page - 1, 1) })} className={`border border-borderSubtle px-3 py-2 uppercase ${page <= 1 ? "pointer-events-none opacity-40" : "hover:border-cyber-cyan hover:text-cyber-cyan"}`}>Prev</Link>
            <span>Page {page} / {totalPages}</span>
            <Link href={buildHref(searchParams, { page: Math.min(page + 1, totalPages) })} className={`border border-borderSubtle px-3 py-2 uppercase ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:border-cyber-cyan hover:text-cyber-cyan"}`}>Next</Link>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Panel title={selectedLead ? "Lead Detail" : "Lead Detail"}>
          {selectedLead ? (
            <div className="space-y-5">
              <div className="grid gap-3 text-xs md:grid-cols-2">
                <div>
                  <p className="font-display text-lg uppercase text-textPrimary">{nameFor(selectedLead)}</p>
                  <p className="text-textSecondary">{selectedLead.email ?? "No email"} | {selectedLead.phone ?? "No phone"}</p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Badge tone={badgeTone(selectedLead.status)}>{selectedLead.status}</Badge>
                  <Badge tone={badgeTone(selectedLead.interest_level)}>{selectedLead.interest_level}</Badge>
                </div>
                <p className="text-textSecondary">Company: {selectedLead.company_name ?? selectedLead.linked_company_name ?? "none"}</p>
                <p className="text-textSecondary">Related contact: {selectedLead.linked_contact_email ?? "none"}</p>
                <p className="text-textSecondary">Source: {selectedLead.source ?? "none"}</p>
                <p className="text-textSecondary">Assigned: {selectedLead.assigned_to ?? "none"}</p>
                <p className="text-textSecondary">Estimated value: {selectedLead.estimated_value ?? "none"}</p>
                <p className="text-textSecondary">Updated: {formatDateTime(selectedLead.updated_at)}</p>
              </div>

              <section className="border-t border-borderSubtle pt-4">
                <p className="mb-3 font-display text-[10px] uppercase tracking-[0.2em] text-cyber-cyan">Edit</p>
                <StatefulForm action={updateLeadAction} submitLabel="Save">
                  <div className="grid gap-2 md:grid-cols-4">
                    <input type="hidden" name="leadId" value={selectedLead.id} />
                    <input name="firstName" defaultValue={selectedLead.first_name ?? ""} className={inputClass()} />
                    <input name="lastName" defaultValue={selectedLead.last_name ?? ""} className={inputClass()} />
                    <input name="email" defaultValue={selectedLead.email ?? ""} className={inputClass()} />
                    <input name="phone" defaultValue={selectedLead.phone ?? ""} className={inputClass()} />
                    <input name="companyName" defaultValue={selectedLead.company_name ?? ""} className={inputClass()} />
                    <input name="title" defaultValue={selectedLead.title ?? ""} className={inputClass()} />
                    <input name="source" defaultValue={selectedLead.source ?? ""} className={inputClass()} />
                    <input name="campaign" defaultValue={selectedLead.campaign ?? ""} className={inputClass()} />
                    <select name="status" defaultValue={selectedLead.status} className={inputClass()}>{LEAD_STATUSES.map((item) => <option key={item}>{item}</option>)}</select>
                    <select name="interestLevel" defaultValue={selectedLead.interest_level} className={inputClass()}>{INTEREST_LEVELS.map((item) => <option key={item}>{item}</option>)}</select>
                    <input name="assignedTo" defaultValue={selectedLead.assigned_to ?? ""} className={inputClass()} />
                    <input name="estimatedValue" defaultValue={selectedLead.estimated_value ?? ""} className={inputClass()} />
                    <input name="nextFollowUpAt" type="datetime-local" className={inputClass()} />
                    <input name="notes" defaultValue={selectedLead.notes ?? ""} className={inputClass()} />
                  </div>
                </StatefulForm>
              </section>

              <section className="border-t border-borderSubtle pt-4">
                <p className="mb-3 font-display text-[10px] uppercase tracking-[0.2em] text-cyber-cyan">Status Quick Actions</p>
                <div className="flex flex-wrap gap-2">
                  {LEAD_STATUSES.map((item) => (
                    <StatefulForm key={item} action={updateLeadStatusAction} submitLabel={item}>
                      <input type="hidden" name="leadId" value={selectedLead.id} />
                      <input type="hidden" name="status" value={item} />
                    </StatefulForm>
                  ))}
                </div>
              </section>

              <section className="grid gap-4 border-t border-borderSubtle pt-4 lg:grid-cols-2">
                <div>
                  <p className="mb-3 font-display text-[10px] uppercase tracking-[0.2em] text-cyber-cyan">Assignment</p>
                  <StatefulForm action={assignLeadAction} submitLabel="Assign">
                    <input type="hidden" name="leadId" value={selectedLead.id} />
                    <input name="assignedTo" placeholder="owner@vulpinehomes.com" className={inputClass()} />
                  </StatefulForm>
                </div>
                <div>
                  <p className="mb-3 font-display text-[10px] uppercase tracking-[0.2em] text-cyber-cyan">Convert / Archive</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedLead.email ? (
                      <StatefulForm action={convertLeadAction} submitLabel="Convert">
                        <input type="hidden" name="leadId" value={selectedLead.id} />
                      </StatefulForm>
                    ) : (
                      <div className="border border-borderSubtle px-3 py-2 text-xs uppercase text-textMuted">Convert requires email</div>
                    )}
                    <StatefulForm action={archiveLeadAction} submitLabel="Archive">
                      <input type="hidden" name="leadId" value={selectedLead.id} />
                    </StatefulForm>
                  </div>
                </div>
              </section>

              <section className="border-t border-borderSubtle pt-4">
                <p className="mb-3 font-display text-[10px] uppercase tracking-[0.2em] text-cyber-cyan">Notes</p>
                <StatefulForm action={addLeadNoteAction} submitLabel="SAVE NOTE">
                  <input type="hidden" name="leadId" value={selectedLead.id} />
                  <textarea name="body" placeholder="Add note" className="input-cyber min-h-20" />
                </StatefulForm>
                <div className="mt-3 space-y-2">
                  {selectedLead.recent_notes.length > 0 ? (
                    selectedLead.recent_notes.map((note) => (
                      <div key={note.id} className="border border-borderSubtle bg-surface/40 p-3 text-xs">
                        <p className="whitespace-pre-wrap text-textPrimary">{note.body}</p>
                        <p className="mt-2 text-[10px] uppercase tracking-wide text-textMuted">
                          {formatDateTime(note.created_at)}
                          {note.created_by ? ` | ${note.created_by}` : ""}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-textSecondary">No notes yet</p>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div className="border border-borderSubtle bg-bgDark p-5 text-sm text-textSecondary">Select a lead row to view and edit the full record.</div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Create Lead">
            <StatefulForm action={createLeadAction} submitLabel="Create Lead">
              <div className="grid gap-3">
                <Field label="First Name"><input name="firstName" className={inputClass()} /></Field>
                <Field label="Last Name"><input name="lastName" className={inputClass()} /></Field>
                <Field label="Email"><input name="email" type="email" className={inputClass()} /></Field>
                <Field label="Phone"><input name="phone" className={inputClass()} /></Field>
                <Field label="Company"><input name="companyName" className={inputClass()} /></Field>
                <Field label="Status"><select name="status" defaultValue="new" className={inputClass()}>{LEAD_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></Field>
                <Field label="Interest"><select name="interestLevel" defaultValue="unknown" className={inputClass()}>{INTEREST_LEVELS.map((item) => <option key={item}>{item}</option>)}</select></Field>
                <Field label="Assigned To"><input name="assignedTo" className={inputClass()} /></Field>
                <Field label="Notes"><textarea name="notes" className={textAreaClass()} /></Field>
              </div>
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
            </div>
          </Panel>
        </div>
      </div>
    </MailShell>
  );
}
