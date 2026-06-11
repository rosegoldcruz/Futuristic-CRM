import { ModulePage } from "@/components/crm-shell/module-page";

export default function DashboardPage() {
  return (
    <ModulePage
      title="Dashboard"
      eyebrow="Core"
      description="Primary CRM dashboard shell for email, revenue, integrations, operations, and admin readiness."
      items={[
        "Email health overview",
        "Operational alerts",
        "Revenue module entry points",
        "Compliance readiness",
      ]}
    />
  );
}
