import Link from "next/link";
import { requireActiveUser } from "@/lib/auth/access";
import { listCampaigns } from "@/lib/email-engine";
import { createCampaign } from "@/lib/mail/actions";
import { getOptions } from "@/lib/mail/data";
import { approveCampaignAction, generateCampaignRecipientsAction, queueCampaignAction } from "@/lib/email-engine/actions";
import { Badge, Field, inputClass, MailShell, Panel } from "@/components/mail/ui";
import { Button } from "@/components/ui/button";

export default async function CampaignsPage() {
  const user = await requireActiveUser();
  const [campaigns, options] = await Promise.all([listCampaigns(), getOptions()]);

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
      <Panel title="Campaign Control">
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="grid gap-3 border border-borderSubtle bg-bgDark p-4 text-xs xl:grid-cols-[1fr_140px_140px_220px]">
              <div>
                <p className="font-display text-sm uppercase text-textPrimary">{campaign.name}</p>
                <p className="mt-1 text-textSecondary">List: {campaign.list_name ?? "none"} | Template: {campaign.template_name ?? "none"}</p>
                <p className="mt-1 text-textSecondary">{Number(campaign.recipients)} recipients | {Number(campaign.queued)} queued</p>
              </div>
              <Badge tone={campaign.status === "queued" ? "green" : "cyan"}>{campaign.status}</Badge>
              <Link href={`/mail/campaigns/${campaign.id}`} className="inline-flex h-8 items-center justify-center border border-borderSubtle px-3 font-display text-xs uppercase text-textPrimary">
                Details
              </Link>
              <div className="flex flex-wrap gap-2">
                <form action={approveCampaignAction}>
                  <input type="hidden" name="campaign_id" value={campaign.id} />
                  <Button type="submit" size="sm" disabled={campaign.status === "approved" || campaign.status === "queued"}>Approve</Button>
                </form>
                <form action={generateCampaignRecipientsAction}>
                  <input type="hidden" name="campaign_id" value={campaign.id} />
                  <Button type="submit" size="sm" variant="secondary">Generate</Button>
                </form>
                <form action={queueCampaignAction}>
                  <input type="hidden" name="campaign_id" value={campaign.id} />
                  <Button type="submit" size="sm" variant="yellow" disabled={campaign.status === "queued"}>Queue</Button>
                </form>
              </div>
            </div>
          ))}
          {campaigns.length === 0 && <p className="text-sm text-textSecondary">No campaigns yet.</p>}
        </div>
      </Panel>
    </MailShell>
  );
}
