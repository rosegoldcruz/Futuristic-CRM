import { requireActiveUser } from "@/lib/auth/access";
import { createTemplate, updateTemplate } from "@/lib/mail/actions";
import { getOptions } from "@/lib/mail/data";
import { renderTemplate } from "@/lib/mail/render-template";
import { getPrisma } from "@/lib/prisma";
import { Field, inputClass, MailShell, Panel, textAreaClass } from "@/components/mail/ui";
import { Button } from "@/components/ui/button";

export default async function TemplatesPage({ searchParams }: { searchParams?: { contact_id?: string } }) {
  const user = await requireActiveUser();
  const options = await getOptions();
  const [previewContact] = searchParams?.contact_id
    ? await getPrisma().$queryRaw<Array<{ first_name: string | null; last_name: string | null; full_name: string | null; email: string; title: string | null; company_name: string | null }>>`
        SELECT c.first_name, c.last_name, c.full_name, c.email, c.title, co.name AS company_name
        FROM email_contacts c LEFT JOIN email_companies co ON co.id = c.company_id
        WHERE c.id = ${searchParams.contact_id}::uuid
      `
    : [];
  const templates = await getPrisma().$queryRaw<Array<{ id: string; name: string; subject: string; body_html: string | null; body_text: string | null; category: string | null }>>`
    SELECT id::text, name, subject, body_html, body_text, category FROM email_templates ORDER BY created_at DESC
  `;
  return (
    <MailShell user={user} title="Templates">
      <Panel title="Create Template">
        <form action={createTemplate} className="grid gap-3">
          <Field label="Name"><input name="name" required className={inputClass()} /></Field>
          <Field label="Subject"><input name="subject" required className={inputClass()} /></Field>
          <Field label="Category"><input name="category" className={inputClass()} /></Field>
          <Field label="Text Body"><textarea name="body_text" className={textAreaClass()} /></Field>
          <Field label="HTML Body"><textarea name="body_html" className={textAreaClass()} /></Field>
          <p className="text-xs text-textSecondary">Variables: {"{{first_name}} {{last_name}} {{full_name}} {{company_name}} {{email}} {{title}}"}</p>
          <Button type="submit">Create Template</Button>
        </form>
      </Panel>
      <Panel title="Preview Contact">
        <form className="grid gap-3 md:grid-cols-[1fr_120px]">
          <select name="contact_id" defaultValue={searchParams?.contact_id ?? ""} className={inputClass()}><option value="">Select contact</option>{options.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select>
          <Button type="submit">Preview</Button>
        </form>
      </Panel>
      <Panel title="Templates">
        <div className="space-y-4">
          {templates.map((template) => (
            <form key={template.id} action={updateTemplate} className="grid gap-3 border border-borderSubtle bg-bgDark p-4">
              <input type="hidden" name="id" value={template.id} />
              <input name="name" defaultValue={template.name} className={inputClass()} />
              <input name="subject" defaultValue={template.subject} className={inputClass()} />
              <input name="category" defaultValue={template.category ?? ""} className={inputClass()} />
              <textarea name="body_text" defaultValue={template.body_text ?? ""} className={textAreaClass()} />
              <textarea name="body_html" defaultValue={template.body_html ?? ""} className={textAreaClass()} />
              {previewContact && (
                <div className="border border-borderSubtle p-3 text-xs text-textSecondary">
                  <p className="text-cyber-cyan">{renderTemplate(template.subject, { firstName: previewContact.first_name, lastName: previewContact.last_name, fullName: previewContact.full_name, companyName: previewContact.company_name, email: previewContact.email, title: previewContact.title })}</p>
                  <pre className="mt-2 whitespace-pre-wrap">{renderTemplate(template.body_text || template.body_html, { firstName: previewContact.first_name, lastName: previewContact.last_name, fullName: previewContact.full_name, companyName: previewContact.company_name, email: previewContact.email, title: previewContact.title })}</pre>
                </div>
              )}
              <Button type="submit" size="sm">Save Template</Button>
            </form>
          ))}
        </div>
      </Panel>
    </MailShell>
  );
}
