import { ModulePage } from "@/components/crm-shell/module-page";

export default function CabinetTakeoffsPage() {
  return (
    <ModulePage
      title="Cabinet Takeoffs"
      eyebrow="Estimating"
      description="Cabinet and materials takeoff management."
      items={[
        "Cabinet takeoff creation",
        "Materials quantification",
        "Takeoff review & approval",
        "Integration with workbook pricing",
      ]}
    />
  );
}
