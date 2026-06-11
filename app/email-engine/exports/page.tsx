import { ModulePage } from "@/components/crm-shell/module-page";

export default function ExportsPage() {
  return (
    <ModulePage
      title="Exports"
      eyebrow="Email Engine"
      description="Export operations with defaults, compliance checks, and audit-ready event records."
      items={["CSV exports", "Export defaults", "Suppression checks", "Export audit events"]}
    />
  );
}
