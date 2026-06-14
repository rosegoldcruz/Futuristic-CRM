import { requireActiveUser } from "@/lib/auth/access";
import { listQueue } from "@/lib/email-engine";
import { getSendGuardStats } from "@/lib/mail/queue";
import { processEmailQueueAction } from "@/lib/mail/actions";
import { cancelQueueItemAction, retryQueueItemAction } from "@/lib/email-engine/actions";
import { StatefulForm } from "@/components/mail/form-state";
import { Badge, MailShell, Panel, inputClass } from "@/components/mail/ui";
import { Button } from "@/components/ui/button";

function tone(status: string) {
  if (status === "queued") return "cyan";
  if (status === "sent") return "green";
  if (status === "failed") return "red";
  if (status === "cancelled") return "yellow";
  return "muted";
}

export default async function QueuePage({ searchParams }: { searchParams?: { status?: string } }) {
  const user = await requireActiveUser();
  const status = searchParams?.status ?? "";
  const [queue, guards] = await Promise.all([listQueue(status), getSendGuardStats()]);

  return (
    <MailShell user={user} title="Email Queue">
      <Panel title="Send Guards">
        <div className="grid gap-3 md:grid-cols-6">
          {[
            ["Effective Cap", guards.effectiveDailyCap],
            ["Warm-Up Cap", guards.warmupCap],
            ["Sent Today", guards.sentToday],
            ["Queued", guards.queued],
            ["Failed", guards.failed],
            ["Suppressed", guards.suppressed],
          ].map(([label, value]) => (
            <div key={label} className="border border-borderSubtle bg-bgDark p-3">
              <p className="text-[10px] uppercase tracking-wider text-textMuted">{label}</p>
              <p className="mt-1 font-display text-xl text-textPrimary">{Number(value).toLocaleString()}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-textSecondary">
          <Badge tone={guards.settings.enabled ? "green" : "red"}>{guards.settings.enabled ? "enabled" : "disabled"}</Badge>
          <span>Batch: {guards.settings.batch_size}</span>
          <span>Interval: {guards.settings.min_seconds_between_sends}s</span>
          <span>Last sent: {guards.lastSentAt?.toLocaleString() ?? "none"}</span>
          <StatefulForm action={processEmailQueueAction} submitLabel="Process Queue">
            <input type="hidden" name="source" value="queue_page" />
          </StatefulForm>
        </div>
      </Panel>
      <Panel title="Filters">
        <form className="grid gap-3 md:grid-cols-[220px_120px]">
          <select name="status" defaultValue={status} className={inputClass()}>
            <option value="">Any status</option>
            {["queued", "failed", "sent", "cancelled"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <Button type="submit">Filter</Button>
        </form>
      </Panel>
      <Panel title="Queue Jobs">
        <div className="space-y-3">
          {queue.map((item) => (
            <div key={item.id} className="grid gap-3 border border-borderSubtle bg-bgDark p-3 text-xs xl:grid-cols-[1fr_1fr_130px_120px_160px]">
              <div>
                <p className="font-display uppercase text-textPrimary">{item.recipient_email}</p>
                <p className="mt-1 text-textSecondary">{item.subject}</p>
              </div>
              <div className="text-textSecondary">
                <p>Provider: {item.provider ?? "not assigned"}</p>
                <p>Attempts: {item.attempt_count}/{item.max_attempts}</p>
                {item.last_error && <p className="text-cyber-red">{item.last_error}</p>}
              </div>
              <Badge tone={tone(item.status)}>{item.status}</Badge>
              <span className="text-textMuted">{item.next_attempt_at?.toLocaleString() ?? "No schedule"}</span>
              <div className="flex flex-wrap gap-2">
                <form action={retryQueueItemAction}>
                  <input type="hidden" name="queue_id" value={item.id} />
                  <Button type="submit" size="sm" disabled={item.status === "queued"}>Retry</Button>
                </form>
                <form action={cancelQueueItemAction}>
                  <input type="hidden" name="queue_id" value={item.id} />
                  <Button type="submit" size="sm" variant="yellow" disabled={item.status !== "queued"}>Cancel</Button>
                </form>
              </div>
            </div>
          ))}
          {queue.length === 0 && <p className="text-sm text-textSecondary">No queue jobs match this filter.</p>}
        </div>
      </Panel>
    </MailShell>
  );
}
