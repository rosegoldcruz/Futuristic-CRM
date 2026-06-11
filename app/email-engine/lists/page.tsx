import { ModulePage } from "@/components/crm-shell/module-page";

export default function ListsPage() {
  return (
    <ModulePage
      title="Lists"
      eyebrow="Email Engine"
      description="Audience lists, segmentation, suppression-aware eligibility, and export-ready list state."
      items={["Segments", "Static lists", "Suppression checks", "Export readiness"]}
    />
  );
}
