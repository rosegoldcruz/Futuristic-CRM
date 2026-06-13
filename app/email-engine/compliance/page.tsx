import Link from "next/link";
import { requireActiveUser } from "@/lib/auth/access";
import { getPrisma } from "@/lib/prisma";
import { listSuppressions } from "@/lib/email-engine";
import { Badge, MailShell, Panel } from "@/components/mail/ui";

type Check = { label: string; ok: boolean; detail: string };

export default async function EmailCompliancePage() {
  const user = await requireActiveUser();
  const prisma = getPrisma();
  const [suppressions, rows] = await Promise.all([
    listSuppressions(),
    prisma.$queryRaw<Array<{
      provider_accounts: bigint;
      active_provider_accounts: bigint;
      lists_with_recipients: bigint;
      templates: bigint;
      templates_with_footer: bigint;
      suppressed_members: bigint;
    }>>`
      SELECT
        (SELECT count(*) FROM email_provider_accounts) AS provider_accounts,
        (SELECT count(*) FROM email_provider_accounts WHERE status = 'active') AS active_provider_accounts,
        (SELECT count(*) FROM email_lists l WHERE EXISTS (SELECT 1 FROM email_list_members m WHERE m.list_id = l.id)) AS lists_with_recipients,
        (SELECT count(*) FROM email_templates WHERE status <> 'archived') AS templates,
        (SELECT count(*) FROM email_templates WHERE coalesce(body_html, body_text, body, '') ILIKE '%unsubscribe%') AS templates_with_footer,
        (SELECT count(*) FROM email_list_members m JOIN email_contacts c ON c.id = m.contact_id JOIN email_suppressions s ON s.email = c.email) AS suppressed_members
    `,
  ]);
  const stats = rows[0];
  const checks: Check[] = [
    { label: "sender exists", ok: Number(stats.provider_accounts) > 0, detail: `${Number(stats.provider_accounts)} provider account records` },
    { label: "provider active", ok: Number(stats.active_provider_accounts) > 0, detail: `${Number(stats.active_provider_accounts)} active provider accounts` },
    { label: "list has recipients", ok: Number(stats.lists_with_recipients) > 0, detail: `${Number(stats.lists_with_recipients)} lists with members` },
    { label: "template exists", ok: Number(stats.templates) > 0, detail: `${Number(stats.templates)} templates` },
    { label: "no suppressed recipients", ok: Number(stats.suppressed_members) === 0, detail: `${Number(stats.suppressed_members)} list memberships suppressed` },
    { label: "unsubscribe footer", ok: Number(stats.templates_with_footer) > 0, detail: `${Number(stats.templates_with_footer)} templates mention unsubscribe` },
  ];

  return (
    <MailShell user={user} title="Email Compliance">
      <Panel title="Readiness Checks">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {checks.map((check) => (
            <div key={check.label} className="border border-borderSubtle bg-bgDark p-3">
              <Badge tone={check.ok ? "green" : "red"}>{check.ok ? "ready" : "blocked"}</Badge>
              <p className="mt-2 font-display text-sm uppercase text-textPrimary">{check.label}</p>
              <p className="mt-1 text-xs text-textSecondary">{check.detail}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Suppressions">
        <div className="mb-4">
          <Link href="/mail/suppressions" className="inline-flex h-9 items-center border border-cyber-cyan px-3 font-display text-xs uppercase text-cyber-cyan">
            Manage Suppressions
          </Link>
        </div>
        <div className="space-y-2">
          {suppressions.slice(0, 50).map((item) => (
            <div key={item.id} className="grid gap-2 border border-borderSubtle bg-bgDark p-3 text-xs md:grid-cols-[1fr_180px_1fr]">
              <span className="text-textPrimary">{item.email}</span>
              <span className="text-cyber-yellow">{item.reason}</span>
              <span className="text-textSecondary">{item.source ?? item.created_at.toLocaleString()}</span>
            </div>
          ))}
          {suppressions.length === 0 && <p className="text-sm text-textSecondary">No suppressions recorded.</p>}
        </div>
      </Panel>
    </MailShell>
  );
}
