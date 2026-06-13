import { requireActiveUser } from "@/lib/auth/access";
import { getOptions } from "@/lib/mail/data";
import { archiveContact, createContact, importContactsCsv, updateContact } from "@/lib/mail/actions";
import { getPrisma } from "@/lib/prisma";
import { StatefulForm } from "@/components/mail/form-state";
import { Badge, Field, inputClass, MailShell, Panel, textAreaClass } from "@/components/mail/ui";
import { Button } from "@/components/ui/button";

export default async function ContactsPage({ searchParams }: { searchParams?: { q?: string; status?: string; source?: string } }) {
  const user = await requireActiveUser();
  const options = await getOptions();
  const q = searchParams?.q?.trim() ?? "";
  const status = searchParams?.status?.trim() ?? "";
  const contacts = await getPrisma().$queryRaw<Array<{ id: string; first_name: string | null; last_name: string | null; full_name: string | null; email: string; phone: string | null; title: string | null; source: string | null; status: string; company_id: string | null; company_name: string | null; notes: string | null }>>`
    SELECT c.id::text, c.first_name, c.last_name, c.full_name, c.email, c.phone, c.title, c.source, c.status, c.company_id::text, co.name AS company_name, c.notes
    FROM email_contacts c
    LEFT JOIN email_companies co ON co.id = c.company_id
    WHERE (${q} = '' OR c.email ILIKE ${`%${q}%`} OR c.full_name ILIKE ${`%${q}%`} OR co.name ILIKE ${`%${q}%`})
      AND (${status} = '' OR c.status = ${status})
    ORDER BY c.created_at DESC
    LIMIT 250
  `;
  return (
    <MailShell user={user} title="Contacts">
      <Panel title="Search">
        <form className="grid gap-3 md:grid-cols-[1fr_220px_120px]">
          <input name="q" placeholder="Search name, email, company" defaultValue={q} className={inputClass()} />
          <select name="status" defaultValue={status} className={inputClass()}>
            <option value="">Any status</option>
            {["active", "bounced", "unsubscribed", "do_not_contact", "archived"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <Button type="submit">Filter</Button>
        </form>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Create Contact">
          <form action={createContact} className="grid gap-3 md:grid-cols-2">
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
        <Panel title="CSV Import">
          <StatefulForm action={importContactsCsv} submitLabel="Import CSV">
            <input name="csv" type="file" accept=".csv,text/csv" required className={inputClass()} />
            <p className="text-xs text-textSecondary">Accepted columns: first_name,last_name,full_name,email,phone,title,company_name,website,source,notes</p>
          </StatefulForm>
        </Panel>
      </div>
      <Panel title="Contact Records">
        <div className="space-y-3">
          {contacts.map((contact) => (
            <form key={contact.id} action={updateContact} className="grid gap-2 border border-borderSubtle bg-bgDark p-3 xl:grid-cols-[1fr_1fr_1fr_140px_90px]">
              <input type="hidden" name="id" value={contact.id} />
              <input name="email" value={contact.email} readOnly className={inputClass()} />
              <input name="full_name" defaultValue={contact.full_name ?? ""} className={inputClass()} />
              <select name="company_id" defaultValue={contact.company_id ?? ""} className={inputClass()}><option value="">No company</option>{options.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <select name="status" defaultValue={contact.status} className={inputClass()}>{["active", "bounced", "unsubscribed", "do_not_contact", "archived"].map((item) => <option key={item}>{item}</option>)}</select>
              <Badge tone={contact.status === "active" ? "green" : "yellow"}>{contact.status}</Badge>
              <input name="first_name" defaultValue={contact.first_name ?? ""} className={inputClass()} />
              <input name="last_name" defaultValue={contact.last_name ?? ""} className={inputClass()} />
              <input name="title" defaultValue={contact.title ?? ""} className={inputClass()} />
              <input name="source" defaultValue={contact.source ?? ""} className={inputClass()} />
              <Button type="submit" size="sm">Save</Button>
              <input name="phone" defaultValue={contact.phone ?? ""} className={inputClass()} />
              <input name="notes" defaultValue={contact.notes ?? ""} className={inputClass()} />
              <button formAction={archiveContact} className="border border-cyber-yellow px-3 py-2 text-xs uppercase text-cyber-yellow">Archive</button>
            </form>
          ))}
        </div>
      </Panel>
    </MailShell>
  );
}
