import { ModulePage } from "@/components/crm-shell/module-page";

export default function ActivityLogPage() {
  return (
    <ModulePage
      title="Activity Log"
      eyebrow="Operations"
      description="Central event log for auth, approvals, campaigns, queue, suppressions, templates, and N8N automation events."
      items={["Privy auth", "User approvals", "Campaign actions", "Queue events", "Suppressions", "Template updates", "N8N automation events"]}
    />
  );
}
