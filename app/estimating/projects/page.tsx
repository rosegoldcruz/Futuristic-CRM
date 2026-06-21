import { ModulePage } from "@/components/crm-shell/module-page";

export default function EstimatingProjectsPage() {
  return (
    <ModulePage
      title="Projects"
      eyebrow="Estimating"
      description="Estimating project management and tracking."
      items={[
        "Active estimating projects",
        "Project bid status",
        "Takeoff assignments",
        "Deadline tracking",
      ]}
    />
  );
}
