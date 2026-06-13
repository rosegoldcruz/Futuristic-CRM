import { requireActiveUser } from "@/lib/auth/access";
import { getPrisma } from "@/lib/prisma";
import { getMailTransportStatus } from "@/lib/mail/smtp";
import { Badge, MailShell, Panel } from "@/components/mail/ui";

export default async function DeliverabilityPage() {
  const user = await requireActiveUser();
  const [transport, providers, rows] = await Promise.all([
    getMailTransportStatus(),
    getPrisma().$queryRaw<Array<{ id: string; name: string; provider: string; from_email: string; status: string }>>`
      SELECT id::text, name, provider, from_email, status
      FROM email_provider_accounts
      ORDER BY created_at DESC
    `,
    getPrisma().$queryRaw<Array<{ total_queue: bigint; failed_queue: bigint; suppressions: bigint }>>`
      SELECT
        (SELECT count(*) FROM email_queue) AS total_queue,
        (SELECT count(*) FROM email_queue WHERE status = 'failed') AS failed_queue,
        (SELECT count(*) FROM email_suppressions) AS suppressions
    `,
  ]);
  const stats = rows[0];
  const totalQueue = Number(stats.total_queue);
  const failedQueue = Number(stats.failed_queue);
  const failureRate = totalQueue === 0 ? 0 : Math.round((failedQueue / totalQueue) * 100);

  return (
    <MailShell user={user} title="Deliverability">
      <Panel title="Transport">
        <Badge tone={transport.available ? "green" : "red"}>{transport.mode}</Badge>
        <p className="mt-3 text-sm text-textSecondary">{transport.message}</p>
      </Panel>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="cyber-card-tw p-4 shadow-cyberInset">
          <p className="text-[10px] uppercase tracking-[0.2em] text-textMuted">Queue Failure Rate</p>
          <p className="mt-2 font-display text-2xl text-textPrimary">{failureRate}%</p>
        </div>
        <div className="cyber-card-tw p-4 shadow-cyberInset">
          <p className="text-[10px] uppercase tracking-[0.2em] text-textMuted">Failed Queue</p>
          <p className="mt-2 font-display text-2xl text-cyber-red">{failedQueue.toLocaleString()}</p>
        </div>
        <div className="cyber-card-tw p-4 shadow-cyberInset">
          <p className="text-[10px] uppercase tracking-[0.2em] text-textMuted">Suppressions</p>
          <p className="mt-2 font-display text-2xl text-textPrimary">{Number(stats.suppressions).toLocaleString()}</p>
        </div>
      </div>
      <Panel title="Provider Accounts">
        <div className="space-y-3">
          {providers.map((provider) => (
            <div key={provider.id} className="grid gap-2 border border-borderSubtle bg-bgDark p-3 text-xs md:grid-cols-[1fr_160px_1fr_120px]">
              <span className="font-display uppercase text-textPrimary">{provider.name}</span>
              <span className="text-textSecondary">{provider.provider}</span>
              <span className="text-textSecondary">{provider.from_email}</span>
              <Badge tone={provider.status === "active" ? "green" : "yellow"}>{provider.status}</Badge>
            </div>
          ))}
          {providers.length === 0 && <p className="text-sm text-textSecondary">No provider account records exist yet.</p>}
        </div>
      </Panel>
      <Panel title="DNS Verification">
        <Badge tone="muted">disabled</Badge>
        <p className="mt-3 text-sm text-textSecondary">DNS verification is not implemented in this repo, so it is not presented as available.</p>
      </Panel>
    </MailShell>
  );
}
