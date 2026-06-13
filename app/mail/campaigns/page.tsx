import Link from "next/link";
import { requireActiveUser } from "@/lib/auth/access";
import { createCampaign } from "@/lib/mail/actions";
import { getOptions } from "@/lib/mail/data";
import { getPrisma } from "@/lib/prisma";
import { Badge, Field, inputClass, MailShell, Panel } from "@/components/mail/ui";
import { Button } from "@/components/ui/button";

export default async function CampaignsPage() {
  const user = await requireActiveUser();
  const options = await getOptions();
  const campaigns = await getPrisma().$queryRaw<Array<{ id: string; name: string; status: string; template_name: string | null; list_name: string | null; recipients: bigint; sent: bigint; failed: bigint }>>`
    SELECT c.id::text, c.name, c.status, t.name AS template_name, l.name AS list_name,
      count(r.id) AS recipients,
      count(r.id) FILTER (WHERE r.status = 'sent') AS sent,
      count(r.id) FILTER (WHERE r.status = 'send_failed') AS failed
    FROM email_campaigns c
    LEFT JOIN email_templates t ON t.id = c.template_id
    LEFT JOIN email_lists l ON l.id = c.list_id
    LEFT JOIN email_campaign_recipients r ON r.campaign_id = c.id
    GROUP BY c.id, t.name, l.name
    ORDER BY c.created_at DESC
  `;
  return (
    <MailShell user={user} title="Campaigns">
      <Panel title="Create Campaign">
        <form action={createCampaign} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_160px]">
          <Field label="Name"><input name="name" required className={inputClass()} /></Field>
          <Field label="Template"><select name="template_id" required className={inputClass()}>{options.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></Field>
          <Field label="List"><select name="list_id" required className={inputClass()}>{options.lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></Field>
          <Button type="submit">Create</Button>
        </form>
      </Panel>
      <Panel title="Campaign Records">
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <Link key={campaign.id} href={`/mail/campaigns/${campaign.id}`} className="grid gap-2 border border-borderSubtle bg-bgDark p-4 text-sm transition hover:border-cyber-cyan md:grid-cols-[1fr_160px_160px_120px]">
              <span className="font-display uppercase text-textPrimary">{campaign.name}</span>
              <span className="text-textSecondary">{campaign.list_name ?? "No list"}</span>
              <span className="text-textSecondary">{campaign.template_name ?? "No template"}</span>
              <Badge tone={campaign.status === "active" ? "green" : "cyan"}>{campaign.status}</Badge>
              <span className="text-xs text-textSecondary">{Number(campaign.recipients)} recipients</span>
              <span className="text-xs text-cyber-green">{Number(campaign.sent)} sent</span>
              <span className="text-xs text-cyber-red">{Number(campaign.failed)} failed</span>
            </Link>
          ))}
        </div>
      </Panel>
    </MailShell>
  );
}
