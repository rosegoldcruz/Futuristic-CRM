import { ModulePage } from "@/components/crm-shell/module-page";

export default function EmailEngineOverviewPage() {
  return (
    <ModulePage
      title="Email Engine Overview"
      eyebrow="Email Engine"
      description="Central operational view for contacts, companies, lists, templates, campaigns, queue, exports, deliverability, compliance, and email settings."
      items={["Campaign status", "Queue health", "Deliverability warnings", "Compliance readiness"]}
    />
  );
}
