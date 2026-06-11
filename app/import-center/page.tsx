import { ModulePage } from "@/components/crm-shell/module-page";

export default function ImportCenterPage() {
  return (
    <ModulePage
      title="Import Center"
      eyebrow="Integrations"
      description="CSV import and N8N automation shell for ingestion workflows."
      status="coming-soon"
      items={["CSV import", "Column mapping", "N8N endpoint", "Import audit events"]}
    />
  );
}
