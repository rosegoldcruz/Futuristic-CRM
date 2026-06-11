import { ModulePage } from "@/components/crm-shell/module-page";

export default function SettingsPage() {
  return (
    <ModulePage
      title="Settings"
      eyebrow="Operations"
      description="Global application settings, separate from Email Engine settings."
      items={[
        "App config",
        "Zitadel config",
        "Database status",
        "Send layer provider",
        "N8N endpoint and API key",
        "Compliance defaults",
        "Export defaults",
      ]}
    />
  );
}
