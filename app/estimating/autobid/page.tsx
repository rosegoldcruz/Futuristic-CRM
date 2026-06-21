import { ModulePage } from "@/components/crm-shell/module-page";

export default function AutobidPage() {
  return (
    <ModulePage
      title="Autobid"
      eyebrow="Estimating"
      description="Automated bidding engine for cabinet and materials takeoffs."
      items={[
        "Automated bid generation",
        "Cabinet takeoff integration",
        "Workbook pricing sync",
        "Bid export pipeline",
      ]}
    />
  );
}
