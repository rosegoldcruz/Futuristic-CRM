import { ModulePage } from "@/components/crm-shell/module-page";

export default function TemplatesPage() {
  return (
    <ModulePage
      title="Templates"
      eyebrow="Email Engine"
      description="Template library with update events ready for audit logging and automation."
      items={["Template versions", "Compliance defaults", "Merge fields", "Update audit events"]}
    />
  );
}
