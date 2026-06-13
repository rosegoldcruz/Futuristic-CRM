import { requireActiveUser } from "@/lib/auth/access";
import { getEmailEngineStats } from "@/lib/email-engine";
import { getMailTransportStatus } from "@/lib/mail/smtp";
import { Badge, MailShell, Panel } from "@/components/mail/ui";

function count(value: bigint | number | null | undefined) {
  return Number(value ?? 0).toLocaleString();
}

export default async function EmailEngineOverviewPage() {
  const user = await requireActiveUser();
  const [stats, transport] = await Promise.all([getEmailEngineStats(), getMailTransportStatus()]);
  const cards = [
    ["Contacts", count(stats.total_contacts)],
    ["Companies", count(stats.total_companies)],
    ["Lists", count(stats.total_lists)],
    ["Templates", count(stats.total_templates)],
    ["Draft Campaigns", count(stats.draft_campaigns)],
    ["Queued Emails", count(stats.queued_emails)],
    ["Failed Emails", count(stats.failed_emails)],
    ["Suppressions", count(stats.suppressions)],
    ["Sent Last 7 Days", count(stats.sent_last_7_days)],
    ["Failed Last 7 Days", count(stats.failed_last_7_days)],
  ];

  return (
    <MailShell user={user} title="Email Engine Overview">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {cards.map(([label, value]) => (
          <div key={label} className="cyber-card-tw p-4 shadow-cyberInset">
            <p className="text-[10px] uppercase tracking-[0.2em] text-textMuted">{label}</p>
            <p className="mt-2 font-display text-2xl text-textPrimary">{value}</p>
          </div>
        ))}
      </div>
      <Panel title="Provider Readiness">
        <Badge tone={transport.available ? "green" : "red"}>{transport.mode}</Badge>
        <p className="mt-3 text-sm text-textSecondary">{transport.message}</p>
      </Panel>
    </MailShell>
  );
}
