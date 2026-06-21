import { ModulePage } from "@/components/crm-shell/module-page";

export default function BidExportsPage() {
  return (
    <ModulePage
      title="Bid Exports"
      eyebrow="Estimating"
      description="Bid export and delivery management."
      items={[
        "Bid package generation",
        "Export format configuration",
        "Delivery tracking",
        "Export history & audit",
      ]}
    />
  );
}
