import { requireActiveUser } from "@/lib/auth/access";
import { getRecentEvents } from "@/lib/mail/data";
import { Badge, MailShell, Panel } from "@/components/mail/ui";

export default async function EventsPage({ searchParams }: { searchParams?: { type?: string } }) {
  const user = await requireActiveUser();
  const events = await getRecentEvents(200);
  const type = searchParams?.type ?? "";
  const filtered = type ? events.filter((event) => event.event_type === type) : events;
  const types = Array.from(new Set(events.map((event) => event.event_type))).sort();
  return (
    <MailShell user={user} title="Email Events">
      <Panel title="Filters">
        <form className="grid gap-3 md:grid-cols-[240px_120px]">
          <select name="type" defaultValue={type} className="input-cyber">
            <option value="">Any event</option>
            {types.map((item) => <option key={item}>{item}</option>)}
          </select>
          <button className="border border-cyber-cyan px-3 py-2 text-xs uppercase text-cyber-cyan">Filter</button>
        </form>
      </Panel>
      <Panel title="Chronological Log">
        <div className="space-y-2">
          {filtered.map((event) => (
            <div key={event.id} className="grid gap-2 border border-borderSubtle bg-bgDark p-3 text-xs xl:grid-cols-[180px_180px_1fr_260px]">
              <span className="text-textMuted">{event.created_at.toLocaleString()}</span>
              <Badge>{event.event_type}</Badge>
              <span className="text-textPrimary">{event.campaign_name ?? event.contact_email ?? "System"}</span>
              <pre className="max-h-24 overflow-auto whitespace-pre-wrap text-textSecondary">{JSON.stringify(event.metadata ?? {}, null, 2)}</pre>
            </div>
          ))}
        </div>
      </Panel>
    </MailShell>
  );
}
