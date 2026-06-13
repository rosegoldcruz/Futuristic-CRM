import { requireActiveUser } from "@/lib/auth/access";
import { getMailDashboard } from "@/lib/mail/data";
import { getMailTransportStatus } from "@/lib/mail/smtp";
import { Badge, MailShell, Panel } from "@/components/mail/ui";

function count(value: bigint | number | null | undefined) {
  return Number(value ?? 0).toLocaleString();
}

export default async function MailDashboardPage() {
  const user = await requireActiveUser();
  const [{ stats, events }, transport] = await Promise.all([getMailDashboard(), getMailTransportStatus()]);
  const cards = [
    ["Total Contacts", count(stats.total_contacts)],
    ["Active Contacts", count(stats.active_contacts)],
    ["Suppressed", count(stats.suppressed_contacts)],
    ["Campaigns", count(stats.campaigns)],
    ["Sent Today", count(stats.sent_today)],
    ["Failed Today", count(stats.failed_today)],
    ["Draft Ready", count(stats.draft_ready)],
    ["Follow-ups Due", count(stats.followups_due)],
    ["Replies Logged", count(stats.replies_logged)],
  ];

  return (
    <MailShell user={user} title="Mail Command Center">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="cyber-card-tw p-4 shadow-cyberInset">
            <p className="text-[10px] uppercase tracking-[0.2em] text-textMuted">{label}</p>
            <p className="mt-2 font-display text-2xl text-textPrimary">{value}</p>
          </div>
        ))}
        <div className="cyber-card-tw p-4 shadow-cyberInset">
          <p className="text-[10px] uppercase tracking-[0.2em] text-textMuted">Sending</p>
          <div className="mt-2">
            <Badge tone={stats.sending_enabled ? "green" : "yellow"}>
              {stats.sending_enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </div>
      </div>
      <Panel title="Transport Status">
        <Badge tone={transport.available ? "green" : "red"}>{transport.mode}</Badge>
        <p className="mt-3 text-sm text-textSecondary">{transport.message}</p>
      </Panel>
      <Panel title="Recent Activity">
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="grid gap-2 border border-borderSubtle bg-bgDark p-3 text-xs md:grid-cols-[180px_1fr_220px]">
              <span className="text-textMuted">{event.created_at.toLocaleString()}</span>
              <span className="text-textPrimary">{event.event_type}</span>
              <span className="truncate text-textSecondary">{event.contact_email ?? event.campaign_name ?? ""}</span>
            </div>
          ))}
          {events.length === 0 && <p className="text-sm text-textSecondary">No email events logged yet.</p>}
        </div>
      </Panel>
    </MailShell>
  );
}
