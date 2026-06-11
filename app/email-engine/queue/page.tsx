import { ModulePage } from "@/components/crm-shell/module-page";

export default function QueuePage() {
  return (
    <ModulePage
      title="Queue"
      eyebrow="Email Engine"
      description="Outbound email queue state with event logging and automation handoff slots."
      items={["Queued messages", "Provider handoff", "Retry state", "Queue events"]}
    />
  );
}
