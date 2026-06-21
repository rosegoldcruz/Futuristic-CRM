import { ModulePage } from "@/components/crm-shell/module-page";

export default function WorkbookPricingPage() {
  return (
    <ModulePage
      title="Workbook Pricing"
      eyebrow="Estimating"
      description="Pricing workbook management and calculations."
      items={[
        "Pricing workbook creation",
        "Cost aggregation",
        "Margin calculations",
        "Price sheet exports",
      ]}
    />
  );
}
