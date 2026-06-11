import { ModulePage } from "@/components/crm-shell/module-page";

export default function EmailCompliancePage() {
  return (
    <ModulePage
      title="Email Compliance"
      eyebrow="Email Engine"
      description="Email-specific compliance checks, suppressions, defaults, and send readiness."
      items={["Suppression checks", "Compliance defaults", "Readiness warnings", "Campaign guardrails"]}
    />
  );
}
