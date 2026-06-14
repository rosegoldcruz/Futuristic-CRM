import { requireActiveUser } from "@/lib/auth/access";
import { updateSendSettings } from "@/lib/mail/actions";
import { ensureSendSettings } from "@/lib/mail/data";
import { getSendGuardStats } from "@/lib/mail/queue";
import { getMailTransportStatus } from "@/lib/mail/smtp";
import { Badge, Field, inputClass, MailShell, Panel } from "@/components/mail/ui";
import { Button } from "@/components/ui/button";

export default async function MailSettingsPage() {
  const user = await requireActiveUser();
  const [settings, transport, guards] = await Promise.all([ensureSendSettings(), getMailTransportStatus(), getSendGuardStats()]);
  return (
    <MailShell user={user} title="Mail Settings">
      <Panel title="SMTP Status">
        <Badge tone={transport.available ? "green" : "red"}>{transport.mode}</Badge>
        <p className="mt-3 text-sm text-textSecondary">{transport.message}</p>
      </Panel>
      <Panel title="Send Guards">
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <div className="border border-borderSubtle bg-bgDark p-3 text-xs">
            <p className="uppercase tracking-wider text-textMuted">Effective Daily Cap</p>
            <p className="mt-1 font-display text-xl text-textPrimary">{guards.effectiveDailyCap}</p>
          </div>
          <div className="border border-borderSubtle bg-bgDark p-3 text-xs">
            <p className="uppercase tracking-wider text-textMuted">Warm-Up Cap</p>
            <p className="mt-1 font-display text-xl text-textPrimary">{guards.warmupCap}</p>
          </div>
          <div className="border border-borderSubtle bg-bgDark p-3 text-xs">
            <p className="uppercase tracking-wider text-textMuted">Sent Today</p>
            <p className="mt-1 font-display text-xl text-textPrimary">{guards.sentToday}</p>
          </div>
          <div className="border border-borderSubtle bg-bgDark p-3 text-xs">
            <p className="uppercase tracking-wider text-textMuted">Queued</p>
            <p className="mt-1 font-display text-xl text-textPrimary">{guards.queued}</p>
          </div>
        </div>
        <form action={updateSendSettings} className="grid gap-3 md:grid-cols-4">
          <label className="flex items-center gap-3 border border-borderSubtle bg-bgDark px-3 py-2 text-xs uppercase text-textSecondary">
            <input name="enabled" type="checkbox" defaultChecked={settings.enabled} />
            Sending Enabled
          </label>
          <Field label="Daily Limit"><input name="daily_limit" type="number" min="1" max="1000" defaultValue={settings.daily_limit} className={inputClass()} /></Field>
          <Field label="Batch Size"><input name="batch_size" type="number" min="1" max="25" defaultValue={settings.batch_size} className={inputClass()} /></Field>
          <Field label="Seconds Between Sends"><input name="min_seconds_between_sends" type="number" min="1" defaultValue={settings.min_seconds_between_sends} className={inputClass()} /></Field>
          <Button type="submit">Save Settings</Button>
        </form>
      </Panel>
    </MailShell>
  );
}
