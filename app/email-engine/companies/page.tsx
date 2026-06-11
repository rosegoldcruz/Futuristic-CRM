import { ModulePage } from "@/components/crm-shell/module-page";

export default function CompaniesPage() {
  return (
    <ModulePage
      title="Companies"
      eyebrow="Contacts & Companies"
      description="Global CRM companies module and Email Engine company account surface."
      items={["Company records", "Associated contacts", "Campaign eligibility", "Source system"]}
    />
  );
}
