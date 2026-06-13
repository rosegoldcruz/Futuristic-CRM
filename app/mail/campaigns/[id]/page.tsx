import { notFound } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/access";
import { addRecipientNote, generateCampaignRecipients, sendCampaignBatch, sendSingleEmail, updateRecipientStatus } from "@/lib/mail/actions";
import { getPrisma } from "@/lib/prisma";
import { CopyButton } from "@/components/mail/copy-button";
import { StatefulForm } from "@/components/mail/form-state";
import { Badge, Field, inputClass, MailShell, Panel } from "@/components/mail/ui";
import { Button } from "@/components/ui/button";

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const user = await requireActiveUser();
  const [campaign] = await getPrisma().$queryRaw<Array<{ id: string; name: string; status: string; template_name: string | null; list_name: string | null }>>`
    SELECT c.id::text, c.name, c.status, t.name AS template_name, l.name AS list_name
    FROM email_campaigns c
    LEFT JOIN email_templates t ON t.id = c.template_id
    LEFT JOIN email_lists l ON l.id = c.list_id
    WHERE c.id = ${params.id}::uuid
  `;
  if (!campaign) notFound();
  const recipients = await getPrisma().$queryRaw<Array<{ id: string; contact_id: string; email: string; full_name: string | null; status: string; personalized_subject: string | null; personalized_html: string | null; personalized_text: string | null; sent_at: Date | null; next_follow_up_at: Date | null; last_error: string | null; notes: string | null }>>`
    SELECT r.id::text, r.contact_id::text, c.email, c.full_name, r.status, r.personalized_subject, r.personalized_html, r.personalized_text, r.sent_at, r.next_follow_up_at, r.last_error, r.notes
    FROM email_campaign_recipients r
    JOIN email_contacts c ON c.id = r.contact_id
    WHERE r.campaign_id = ${params.id}::uuid
    ORDER BY r.created_at DESC
  `;
  const stats = recipients.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.status]: (acc[item.status] ?? 0) + 1 }), {});

  return (
    <MailShell user={user} title={campaign.name}>
      <Panel title="Campaign Controls">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>{campaign.status}</Badge>
          <span className="text-xs text-textSecondary">List: {campaign.list_name ?? "none"}</span>
          <span className="text-xs text-textSecondary">Template: {campaign.template_name ?? "none"}</span>
          <form action={generateCampaignRecipients}><input type="hidden" name="campaign_id" value={campaign.id} /><Button type="submit" size="sm">Generate Recipients</Button></form>
          <form action={sendCampaignBatch}><input type="hidden" name="campaign_id" value={campaign.id} /><Button type="submit" size="sm" variant="yellow">Send Next Batch</Button></form>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {["draft_ready", "sent", "send_failed", "replied", "suppressed"].map((key) => (
            <div key={key} className="border border-borderSubtle bg-bgDark p-3">
              <p className="text-[10px] uppercase tracking-wider text-textMuted">{key}</p>
              <p className="mt-1 font-display text-xl">{stats[key] ?? 0}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Recipients">
        <div className="space-y-4">
          {recipients.map((recipient) => {
            const body = recipient.personalized_text || recipient.personalized_html || "";
            const mailto = `mailto:${recipient.email}?subject=${encodeURIComponent(recipient.personalized_subject ?? "")}&body=${encodeURIComponent(body)}`;
            return (
              <div key={recipient.id} className="border border-borderSubtle bg-bgDark p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-sm uppercase text-textPrimary">{recipient.full_name || recipient.email}</p>
                    <p className="text-xs text-textSecondary">{recipient.email}</p>
                    {recipient.last_error && <p className="mt-1 text-xs text-cyber-red">{recipient.last_error}</p>}
                  </div>
                  <Badge tone={recipient.status === "sent" ? "green" : recipient.status === "send_failed" ? "red" : "cyan"}>{recipient.status}</Badge>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-textMuted">Subject</p>
                    <p className="mt-1 text-sm text-textPrimary">{recipient.personalized_subject}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CopyButton value={recipient.personalized_subject ?? ""} label="Copy Subject" />
                    <CopyButton value={body} label="Copy Body" />
                    <a href={mailto} className="inline-flex h-8 items-center border border-cyber-cyan px-3 text-xs uppercase text-cyber-cyan">Mailto</a>
                  </div>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap border border-borderSubtle p-3 text-xs text-textSecondary lg:col-span-2">{body}</pre>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatefulForm action={sendSingleEmail} submitLabel="Send Now">
                    <input type="hidden" name="to" value={recipient.email} />
                    <input type="hidden" name="subject" value={recipient.personalized_subject ?? ""} />
                    <input type="hidden" name="text" value={recipient.personalized_text ?? ""} />
                    <input type="hidden" name="html" value={recipient.personalized_html ?? ""} />
                    <input type="hidden" name="campaign_id" value={campaign.id} />
                    <input type="hidden" name="recipient_id" value={recipient.id} />
                    <input type="hidden" name="contact_id" value={recipient.contact_id} />
                  </StatefulForm>
                  {["sent_manually", "replied", "closed_won", "closed_lost", "skipped"].map((status) => (
                    <form key={status} action={updateRecipientStatus}>
                      <input type="hidden" name="id" value={recipient.id} />
                      <input type="hidden" name="status" value={status} />
                      <Button type="submit" size="sm" variant="secondary">{status}</Button>
                    </form>
                  ))}
                  <form action={updateRecipientStatus} className="flex gap-2">
                    <input type="hidden" name="id" value={recipient.id} />
                    <input type="hidden" name="status" value="follow_up_needed" />
                    <input name="next_follow_up_at" type="datetime-local" className={inputClass()} />
                    <Button type="submit" size="sm">Follow Up</Button>
                  </form>
                </div>
                <form action={addRecipientNote} className="mt-3 flex gap-2">
                  <input type="hidden" name="id" value={recipient.id} />
                  <Field label="Note"><input name="note" className={inputClass()} /></Field>
                  <Button type="submit" size="sm">Add Note</Button>
                </form>
                {recipient.notes && <pre className="mt-2 whitespace-pre-wrap text-xs text-textSecondary">{recipient.notes}</pre>}
              </div>
            );
          })}
          {recipients.length === 0 && <p className="text-sm text-textSecondary">Generate recipients from the selected list and template.</p>}
        </div>
      </Panel>
    </MailShell>
  );
}
