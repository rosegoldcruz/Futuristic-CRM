import Link from "next/link";
import { requireActiveUser } from "@/lib/auth/access";
import { getPrisma } from "@/lib/prisma";
import { getMailTransportStatus } from "@/lib/mail/smtp";
import { Badge, MailShell, Panel } from "@/components/mail/ui";

function envStatus(name: string) {
  return process.env[name] ? "configured" : `Missing required env var: ${name}`;
}

export default async function EmailSettingsPage() {
  const user = await requireActiveUser();
  const [transport, providers, settings] = await Promise.all([
    getMailTransportStatus(),
    getPrisma().$queryRaw<Array<{ id: string; name: string; provider: string; from_email: string; from_name: string | null; status: string }>>`
      SELECT id::text, name, provider, from_email, from_name, status
      FROM email_provider_accounts
      ORDER BY created_at DESC
    `,
    getPrisma().$queryRaw<Array<{ key: string; value: unknown }>>`
      SELECT key, value FROM app_settings ORDER BY key
    `,
  ]);

  return (
    <MailShell user={user} title="Email Engine Settings">
      <Panel title="Transport">
        <Badge tone={transport.available ? "green" : "red"}>{transport.mode}</Badge>
        <p className="mt-3 text-sm text-textSecondary">{transport.message}</p>
        <div className="mt-4">
          <Link href="/mail/settings" className="inline-flex h-9 items-center border border-cyber-cyan px-3 font-display text-xs uppercase text-cyber-cyan">
            Edit Send Guards
          </Link>
        </div>
      </Panel>
      <Panel title="Environment">
        <div className="grid gap-2 text-xs md:grid-cols-2">
          {[
            "EMAIL_DRY_RUN",
            "SMTP_HOST",
            "SMTP_PORT",
            "SMTP_USER",
            "SMTP_PASS",
            "SMTP_FROM",
            "EMAIL_DEFAULT_FROM",
            "EMAIL_DEFAULT_FROM_NAME",
            "EMAIL_PROVIDER",
            "EMAIL_WEBHOOK_SECRET",
            "EMAIL_CRON_SECRET",
            "N8N_WEBHOOK_URL",
          ].map((name) => (
            <div key={name} className="flex items-center justify-between gap-3 border border-borderSubtle bg-bgDark p-3">
              <span className="text-textPrimary">{name}</span>
              <span className={process.env[name] ? "text-cyber-green" : "text-cyber-red"}>{envStatus(name)}</span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Provider Accounts">
        <div className="space-y-3">
          {providers.map((provider) => (
            <div key={provider.id} className="grid gap-2 border border-borderSubtle bg-bgDark p-3 text-xs md:grid-cols-[1fr_160px_1fr_120px]">
              <span className="font-display uppercase text-textPrimary">{provider.name}</span>
              <span className="text-textSecondary">{provider.provider}</span>
              <span className="text-textSecondary">{provider.from_name ? `${provider.from_name} <${provider.from_email}>` : provider.from_email}</span>
              <Badge tone={provider.status === "active" ? "green" : "yellow"}>{provider.status}</Badge>
            </div>
          ))}
          {providers.length === 0 && <p className="text-sm text-textSecondary">No provider account rows exist yet.</p>}
        </div>
      </Panel>
      <Panel title="App Settings">
        <div className="space-y-2">
          {settings.map((setting) => (
            <div key={setting.key} className="grid gap-2 border border-borderSubtle bg-bgDark p-3 text-xs md:grid-cols-[240px_1fr]">
              <span className="font-display uppercase text-textPrimary">{setting.key}</span>
              <pre className="overflow-auto text-textSecondary">{JSON.stringify(setting.value)}</pre>
            </div>
          ))}
          {settings.length === 0 && <p className="text-sm text-textSecondary">No app settings rows exist yet.</p>}
        </div>
      </Panel>
    </MailShell>
  );
}
