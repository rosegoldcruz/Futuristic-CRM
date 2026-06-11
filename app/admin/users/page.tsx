import { ModulePage } from "@/components/crm-shell/module-page";

export default function AdminUsersPage() {
  return (
    <ModulePage
      title="Admin Users"
      eyebrow="Admin"
      description="Admin-only user management shell for approvals, roles, disabling access, owner protection, and audit logging."
      items={["Approve pending", "Disable users", "Change roles", "Prevent removing last OWNER", "Audit logging"]}
      requiredRoles={["OWNER", "ADMIN"]}
    />
  );
}
