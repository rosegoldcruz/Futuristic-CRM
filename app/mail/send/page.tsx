import { requireActiveUser } from "@/lib/auth/access";
import { enqueueManualCampaignAction, processEmailQueueAction, sendSingleEmail } from "@/lib/mail/actions";
import { getSendGuardStats } from "@/lib/mail/queue";
import { getMailTransportStatus } from "@/lib/mail/smtp";
import { StatefulForm } from "@/components/mail/form-state";
import { Badge, Field, inputClass, MailShell, Panel, textAreaClass } from "@/components/mail/ui";

export default async function SendPage() {
  const user = await requireActiveUser();
  const [transport, guards] = await Promise.all([getMailTransportStatus(), getSendGuardStats()]);
  return (
    <MailShell user={user} title="Single Send">
      <Panel title="Transport">
        <Badge tone={transport.available ? "green" : "red"}>{transport.mode}</Badge>
        <p className="mt-3 text-sm text-textSecondary">{transport.message}</p>
      </Panel>
      <Panel title="Queue Controls">
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <div className="border border-borderSubtle bg-bgDark p-3 text-xs">
            <p className="uppercase tracking-wider text-textMuted">Effective Cap</p>
            <p className="mt-1 font-display text-xl text-textPrimary">{guards.effectiveDailyCap}</p>
          </div>
          <div className="border border-borderSubtle bg-bgDark p-3 text-xs">
            <p className="uppercase tracking-wider text-textMuted">Sent Today</p>
            <p className="mt-1 font-display text-xl text-textPrimary">{guards.sentToday}</p>
          </div>
          <div className="border border-borderSubtle bg-bgDark p-3 text-xs">
            <p className="uppercase tracking-wider text-textMuted">Queued</p>
            <p className="mt-1 font-display text-xl text-textPrimary">{guards.queued}</p>
          </div>
          <div className="border border-borderSubtle bg-bgDark p-3 text-xs">
            <p className="uppercase tracking-wider text-textMuted">Failed</p>
            <p className="mt-1 font-display text-xl text-textPrimary">{guards.failed}</p>
          </div>
        </div>
        <StatefulForm action={processEmailQueueAction} submitLabel="Process Queue">
          <input type="hidden" name="source" value="send_page" />
        </StatefulForm>
      </Panel>
      <Panel title="Queue One Email">
        <StatefulForm action={sendSingleEmail} submitLabel="Queue Email">
          <Field label="To"><input name="to" type="email" required className={inputClass()} /></Field>
          <Field label="Subject"><input name="subject" required className={inputClass()} /></Field>
          <Field label="Text Body"><textarea name="text" className={textAreaClass()} /></Field>
          <Field label="HTML Body"><textarea name="html" className={textAreaClass()} /></Field>
        </StatefulForm>
      </Panel>
      <Panel title="Manual Campaign Queue">
        <StatefulForm action={enqueueManualCampaignAction} submitLabel="Queue Campaign">
          <Field label="Campaign Name"><input name="name" required className={inputClass()} /></Field>
          <Field label="Source">
            <select name="source" defaultValue="contacts" className={inputClass()}>
              <option value="contacts">contacts</option>
              <option value="leads">leads</option>
              <option value="both">both</option>
            </select>
          </Field>
          <Field label="Contact IDs"><textarea name="contact_ids" placeholder="Optional comma or newline separated IDs. Blank selects recent contacts." className={textAreaClass()} /></Field>
          <Field label="Lead IDs"><textarea name="lead_ids" placeholder="Optional comma or newline separated IDs. Blank selects recent leads." className={textAreaClass()} /></Field>
          <Field label="Subject"><input name="subject" required className={inputClass()} /></Field>
          <Field label="Text Body"><textarea name="text" className={textAreaClass()} /></Field>
          <Field label="HTML Body"><textarea name="html" className={textAreaClass()} /></Field>
        </StatefulForm>
      </Panel>
    </MailShell>
  );
}
