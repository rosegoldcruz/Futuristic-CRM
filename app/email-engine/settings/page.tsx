import { ModulePage } from "@/components/crm-shell/module-page";

export default function EmailSettingsPage() {
  return (
    <ModulePage
      title="Email Engine Settings"
      eyebrow="Email Engine"
      description="Email-specific settings for provider presence, queue behavior, exports, and automation."
      items={["Provider presence", "Queue defaults", "Export defaults", "N8N handoff"]}
    />
  );
}
