import { Download } from "lucide-react";
import { requireActiveUser } from "@/lib/auth/access";
import { MailShell, Panel } from "@/components/mail/ui";

const exports = [
  ["contacts", "Contacts CSV"],
  ["companies", "Companies CSV"],
  ["suppressions", "Suppressions CSV"],
  ["campaign-events", "Campaign Events CSV"],
] as const;

export default async function ExportsPage() {
  const user = await requireActiveUser();

  return (
    <MailShell user={user} title="Email Exports">
      <Panel title="CSV Exports">
        <div className="grid gap-3 md:grid-cols-2">
          {exports.map(([type, label]) => (
            <a
              key={type}
              href={`/api/email-engine/exports/${type}`}
              className="inline-flex h-11 items-center justify-between border border-borderSubtle bg-bgDark px-3 font-display text-xs uppercase text-textPrimary transition hover:border-cyber-cyan hover:text-cyber-cyan"
            >
              <span>{label}</span>
              <Download className="h-4 w-4" aria-hidden />
            </a>
          ))}
        </div>
      </Panel>
    </MailShell>
  );
}
