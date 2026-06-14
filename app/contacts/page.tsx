import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { requireActiveUser } from "@/lib/auth/access";
import { CONTACT_STATUSES, countContacts, getContactDetail, listContacts } from "@/lib/contacts";
import { getOptions } from "@/lib/mail/data";
import { archiveContact, createContact, updateContact } from "@/lib/mail/actions";
import { Badge, Field, inputClass, MailShell, Panel, textAreaClass } from "@/components/mail/ui";
import { Button } from "@/components/ui/button";

type SearchParams = Record<string, string | string[] | undefined>;

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const SORT_KEYS = ["name", "company", "phone", "email", "role", "status", "relatedLeads", "lastActivity", "createdAt", "updatedAt"];

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

function contactName(contact: { full_name: string | null; first_name: string | null; last_name: string | null; email: string }) {
  return contact.full_name || [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email;
}

function badgeTone(status: string) {
  if (status === "active") return "green";
  if (status === "do_not_contact" || status === "archived") return "red";
  if (status === "bounced" || status === "unsubscribed") return "yellow";
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
  return query ? `/contacts?${query}` : "/contacts";
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

export default async function ContactsPage({ searchParams }: { searchParams?: SearchParams }) {
  const user = await requireActiveUser();
  const q = param(searchParams, "q");
  const status = param(searchParams, "status");
  const source = param(searchParams, "source");
  const company = param(searchParams, "company");
  const selectedId = param(searchParams, "selected");
  const page = numberParam(searchParams, "page", 1);
  const pageSize = pageSizeParam(searchParams);
  const requestedSort = param(searchParams, "sort") || "updatedAt";
  const sort = SORT_KEYS.includes(requestedSort) ? requestedSort : "updatedAt";
  const dir = param(searchParams, "dir") === "asc" ? "asc" : "desc";
  const offset = (page - 1) * pageSize;
  const filters = { search: q, status, source, company, limit: pageSize, offset, sort, dir };

  const [contacts, total, options, selectedDetail] = await Promise.all([
    listContacts(filters),
    countContacts(filters),
    getOptions(),
    selectedId ? getContactDetail(selectedId) : Promise.resolve(null),
  ]);
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <MailShell user={user} title="Contacts">
      <Panel title="Contact Records">
        <form className="mb-4 grid gap-3 lg:grid-cols-[1fr_170px_170px_190px_100px]">
          <input name="q" defaultValue={q} placeholder="Search name, email, phone, company, notes" className={inputClass()} />
          <select name="status" defaultValue={status} className={inputClass()}>
            <option value="">Any status</option>
            {CONTACT_STATUSES.map((item) => <option key={item}>{item}</option>)}
          </select>
          <input name="source" defaultValue={source} placeholder="Source" className={inputClass()} />
          <input name="company" defaultValue={company} placeholder="Company" className={inputClass()} />
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
          <input type="hidden" name="pageSize" value={pageSize} />
          <Button type="submit">Search</Button>
        </form>

        <div className="overflow-x-auto border border-borderSubtle">
          <table className="min-w-[1080px] w-full border-collapse text-left text-xs">
            <thead className="bg-bgDark text-[10px] uppercase tracking-wider">
              <tr className="border-b border-borderSubtle">
                <th className="px-3 py-2"><SortHeader label="Name" sortKey="name" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2"><SortHeader label="Company" sortKey="company" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2"><SortHeader label="Phone" sortKey="phone" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2"><SortHeader label="Email" sortKey="email" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2"><SortHeader label="Type / Role" sortKey="role" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2"><SortHeader label="Status" sortKey="status" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2"><SortHeader label="Leads" sortKey="relatedLeads" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2"><SortHeader label="Last Activity" sortKey="lastActivity" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2"><SortHeader label="Created" sortKey="createdAt" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2"><SortHeader label="Updated" sortKey="updatedAt" currentSort={sort} currentDir={dir} searchParams={searchParams} /></th>
                <th className="px-3 py-2 text-textSecondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id} className={`border-b border-borderSubtle bg-bgDark/60 hover:bg-surface ${contact.id === selectedId ? "outline outline-1 outline-cyber-cyan" : ""}`}>
                  <td className="px-3 py-2 font-medium text-textPrimary">{contactName(contact)}</td>
                  <td className="px-3 py-2 text-textSecondary">{contact.company_name ?? "none"}</td>
                  <td className="px-3 py-2 text-textSecondary">{contact.phone ?? "none"}</td>
                  <td className="px-3 py-2 text-textSecondary">{contact.email}</td>
                  <td className="px-3 py-2 text-textSecondary">{contact.title ?? contact.company_type ?? "none"}</td>
                  <td className="px-3 py-2"><Badge tone={badgeTone(contact.status)}>{contact.status}</Badge></td>
                  <td className="px-3 py-2 text-textSecondary">{contact.related_leads_count}</td>
                  <td className="px-3 py-2 text-textSecondary">{formatDate(contact.last_activity_at)}</td>
                  <td className="px-3 py-2 text-textSecondary">{formatDate(contact.created_at)}</td>
                  <td className="px-3 py-2 text-textSecondary">{formatDate(contact.updated_at)}</td>
                  <td className="px-3 py-2">
                    <Link href={buildHref(searchParams, { selected: contact.id })} className="font-display text-[10px] uppercase tracking-wider text-cyber-cyan hover:text-cyber-green">
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-5 text-center text-sm text-textSecondary">No contacts match this view.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-textSecondary">
          <p>Showing {contacts.length ? offset + 1 : 0}-{Math.min(offset + contacts.length, total)} of {total}</p>
          <div className="flex items-center gap-2">
            <Link href={buildHref(searchParams, { page: Math.max(page - 1, 1) })} className={`border border-borderSubtle px-3 py-2 uppercase ${page <= 1 ? "pointer-events-none opacity-40" : "hover:border-cyber-cyan hover:text-cyber-cyan"}`}>Prev</Link>
            <span>Page {page} / {totalPages}</span>
            <Link href={buildHref(searchParams, { page: Math.min(page + 1, totalPages) })} className={`border border-borderSubtle px-3 py-2 uppercase ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:border-cyber-cyan hover:text-cyber-cyan"}`}>Next</Link>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Panel title="Contact Detail">
          {selectedDetail ? (
            <div className="space-y-5">
              <div className="grid gap-3 text-xs md:grid-cols-2">
                <div>
                  <p className="font-display text-lg uppercase text-textPrimary">{contactName(selectedDetail.contact)}</p>
                  <p className="text-textSecondary">{selectedDetail.contact.email} | {selectedDetail.contact.phone ?? "No phone"}</p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Badge tone={badgeTone(selectedDetail.contact.status)}>{selectedDetail.contact.status}</Badge>
                  <Badge tone="muted">{selectedDetail.contact.consent_status}</Badge>
                </div>
                <p className="text-textSecondary">Company: {selectedDetail.contact.company_name ?? "none"}</p>
                <p className="text-textSecondary">Role: {selectedDetail.contact.title ?? selectedDetail.contact.company_type ?? "none"}</p>
                <p className="text-textSecondary">Source: {selectedDetail.contact.source ?? "none"}</p>
                <p className="text-textSecondary">Related leads: {selectedDetail.contact.related_leads_count}</p>
                <p className="text-textSecondary">Last activity: {formatDateTime(selectedDetail.contact.last_activity_at)}</p>
                <p className="text-textSecondary">Updated: {formatDateTime(selectedDetail.contact.updated_at)}</p>
              </div>

              <section className="border-t border-borderSubtle pt-4">
                <p className="mb-3 font-display text-[10px] uppercase tracking-[0.2em] text-cyber-cyan">Edit</p>
                <form action={updateContact} className="grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="id" value={selectedDetail.contact.id} />
                  <Field label="Email"><input name="email" value={selectedDetail.contact.email} readOnly className={inputClass()} /></Field>
                  <Field label="Company"><select name="company_id" defaultValue={selectedDetail.contact.company_id ?? ""} className={inputClass()}><option value="">No company</option>{options.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                  <Field label="First Name"><input name="first_name" defaultValue={selectedDetail.contact.first_name ?? ""} className={inputClass()} /></Field>
                  <Field label="Last Name"><input name="last_name" defaultValue={selectedDetail.contact.last_name ?? ""} className={inputClass()} /></Field>
                  <Field label="Full Name"><input name="full_name" defaultValue={selectedDetail.contact.full_name ?? ""} className={inputClass()} /></Field>
                  <Field label="Title"><input name="title" defaultValue={selectedDetail.contact.title ?? ""} className={inputClass()} /></Field>
                  <Field label="Phone"><input name="phone" defaultValue={selectedDetail.contact.phone ?? ""} className={inputClass()} /></Field>
                  <Field label="Source"><input name="source" defaultValue={selectedDetail.contact.source ?? ""} className={inputClass()} /></Field>
                  <Field label="Status"><select name="status" defaultValue={selectedDetail.contact.status} className={inputClass()}>{CONTACT_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></Field>
                  <Field label="Notes"><textarea name="notes" defaultValue={selectedDetail.contact.notes ?? ""} className={textAreaClass()} /></Field>
                  <Button type="submit">Save Contact</Button>
                </form>
              </section>

              <section className="border-t border-borderSubtle pt-4">
                <p className="mb-3 font-display text-[10px] uppercase tracking-[0.2em] text-cyber-cyan">Related Leads</p>
                <div className="space-y-2">
                  {selectedDetail.relatedLeads.length ? (
                    selectedDetail.relatedLeads.map((lead) => (
                      <Link key={lead.id} href={`/leads?selected=${lead.id}`} className="block border border-borderSubtle bg-bgDark p-3 text-xs hover:border-cyber-cyan">
                        <span className="text-textPrimary">{lead.name ?? "Unnamed lead"}</span>
                        <span className="ml-2 text-textSecondary">{lead.status} | {lead.source ?? "no source"} | {lead.estimated_value ?? "no value"}</span>
                      </Link>
                    ))
                  ) : (
                    <p className="text-xs text-textSecondary">No related leads</p>
                  )}
                </div>
              </section>

              <section className="border-t border-borderSubtle pt-4">
                <form action={archiveContact}>
                  <input type="hidden" name="id" value={selectedDetail.contact.id} />
                  <Button type="submit" variant="yellow">Archive Contact</Button>
                </form>
              </section>
            </div>
          ) : (
            <div className="border border-borderSubtle bg-bgDark p-5 text-sm text-textSecondary">Select a contact row to view and edit the full record.</div>
          )}
        </Panel>

        <Panel title="Create Contact">
          <form action={createContact} className="grid gap-3">
            <Field label="Email"><input name="email" required type="email" className={inputClass()} /></Field>
            <Field label="Company"><select name="company_id" className={inputClass()}><option value="">No company</option>{options.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="First Name"><input name="first_name" className={inputClass()} /></Field>
            <Field label="Last Name"><input name="last_name" className={inputClass()} /></Field>
            <Field label="Full Name"><input name="full_name" className={inputClass()} /></Field>
            <Field label="Title"><input name="title" className={inputClass()} /></Field>
            <Field label="Phone"><input name="phone" className={inputClass()} /></Field>
            <Field label="Source"><input name="source" className={inputClass()} /></Field>
            <Field label="Notes"><textarea name="notes" className={textAreaClass()} /></Field>
            <Button type="submit">Save Contact</Button>
          </form>
        </Panel>
      </div>
    </MailShell>
  );
}
