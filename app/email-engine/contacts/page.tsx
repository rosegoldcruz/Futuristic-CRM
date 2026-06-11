import { ModulePage } from "@/components/crm-shell/module-page";

export default function ContactsPage() {
  return (
    <ModulePage
      title="Contacts"
      eyebrow="Contacts & Companies"
      description="Global CRM contacts module and Email Engine contact surface."
      items={["Contact records", "Suppression status", "List membership", "Import provenance"]}
    />
  );
}
