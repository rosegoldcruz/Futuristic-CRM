import { ModulePage } from "@/components/crm-shell/module-page";

export default function CampaignsPage() {
  return (
    <ModulePage
      title="Campaigns"
      eyebrow="Email Engine"
      description="Campaign operations surface with queue, compliance, and N8N automation hooks."
      items={["Draft campaigns", "Approval state", "Queue handoff", "Campaign audit events"]}
    />
  );
}
