import { ModulePage } from "@/components/crm-shell/module-page";

export default function ComplianceCenterPage() {
  return (
    <ModulePage
      title="Compliance Center"
      eyebrow="Operations"
      description="Centralized compliance rules, suppression management, and readiness warnings."
      items={["Compliance rules", "Suppression management", "Readiness warnings", "Campaign guardrails"]}
    />
  );
}
