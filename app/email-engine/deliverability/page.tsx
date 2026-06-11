import { ModulePage } from "@/components/crm-shell/module-page";

export default function DeliverabilityPage() {
  return (
    <ModulePage
      title="Deliverability"
      eyebrow="Email Engine"
      description="Deliverability readiness surface for send layer, provider presence, and warnings."
      items={["Send layer provider", "SMTP presence", "Smartlead presence", "Instantly presence"]}
    />
  );
}
