import { requireActiveUser } from "@/lib/auth/access";
import { getPrisma } from "@/lib/prisma";
import { createCompany, updateCompany } from "@/lib/mail/actions";
import { Field, inputClass, MailShell, Panel, textAreaClass } from "@/components/mail/ui";
import { Button } from "@/components/ui/button";

export default async function CompaniesPage() {
  const user = await requireActiveUser();
  const companies = await getPrisma().$queryRaw<Array<{ id: string; name: string; website: string | null; industry: string | null; phone: string | null; contacts: bigint; notes: string | null }>>`
    SELECT co.id::text, co.name, co.website, co.industry, co.phone, co.notes, count(c.id) AS contacts
    FROM email_companies co
    LEFT JOIN email_contacts c ON c.company_id = co.id
    GROUP BY co.id
    ORDER BY co.name
  `;
  return (
    <MailShell user={user} title="Companies">
      <Panel title="Create Company">
        <form action={createCompany} className="grid gap-3 md:grid-cols-3">
          <Field label="Name"><input name="name" required className={inputClass()} /></Field>
          <Field label="Website"><input name="website" className={inputClass()} /></Field>
          <Field label="Phone"><input name="phone" className={inputClass()} /></Field>
          <Field label="Industry"><input name="industry" className={inputClass()} /></Field>
          <Field label="Type"><input name="company_type" className={inputClass()} /></Field>
          <Field label="Notes"><textarea name="notes" className={textAreaClass()} /></Field>
          <Button type="submit">Create Company</Button>
        </form>
      </Panel>
      <Panel title="Company Records">
        <div className="space-y-3">
          {companies.map((company) => (
            <form key={company.id} action={updateCompany} className="grid gap-2 border border-borderSubtle bg-bgDark p-3 md:grid-cols-[1fr_1fr_1fr_100px]">
              <input type="hidden" name="id" value={company.id} />
              <input name="name" defaultValue={company.name} className={inputClass()} />
              <input name="website" defaultValue={company.website ?? ""} className={inputClass()} />
              <input name="industry" defaultValue={company.industry ?? ""} className={inputClass()} />
              <span className="text-xs text-textSecondary">{Number(company.contacts)} contacts</span>
              <input name="phone" defaultValue={company.phone ?? ""} className={inputClass()} />
              <input name="notes" defaultValue={company.notes ?? ""} className={inputClass()} />
              <Button type="submit" size="sm">Save</Button>
            </form>
          ))}
        </div>
      </Panel>
    </MailShell>
  );
}
