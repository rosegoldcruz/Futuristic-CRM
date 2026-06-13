import { requireActiveUser } from "@/lib/auth/access";
import { addSuppression, removeSuppression } from "@/lib/mail/actions";
import { getPrisma } from "@/lib/prisma";
import { Field, inputClass, MailShell, Panel } from "@/components/mail/ui";
import { Button } from "@/components/ui/button";

export default async function SuppressionsPage() {
  const user = await requireActiveUser();
  const suppressions = await getPrisma().$queryRaw<Array<{ id: string; email: string; reason: string; source: string | null; created_at: Date }>>`
    SELECT id::text, email, reason, source, created_at FROM email_suppressions ORDER BY created_at DESC
  `;
  return (
    <MailShell user={user} title="Suppressions">
      <Panel title="Add Suppression">
        <form action={addSuppression} className="grid gap-3 md:grid-cols-[1fr_220px_1fr_160px]">
          <Field label="Email"><input name="email" type="email" required className={inputClass()} /></Field>
          <Field label="Reason"><select name="reason" required className={inputClass()}>{["bounced", "unsubscribed", "complaint", "do_not_contact", "invalid"].map((reason) => <option key={reason}>{reason}</option>)}</select></Field>
          <Field label="Source"><input name="source" className={inputClass()} /></Field>
          <Button type="submit">Suppress</Button>
        </form>
      </Panel>
      <Panel title="Suppression List">
        <div className="space-y-2">
          {suppressions.map((item) => (
            <form key={item.id} action={removeSuppression} className="grid gap-2 border border-borderSubtle bg-bgDark p-3 text-xs md:grid-cols-[1fr_180px_1fr_120px]">
              <input type="hidden" name="id" value={item.id} />
              <span className="text-textPrimary">{item.email}</span>
              <span className="text-cyber-yellow">{item.reason}</span>
              <span className="text-textSecondary">{item.source ?? item.created_at.toLocaleString()}</span>
              <button type="submit" className="border border-cyber-red px-3 py-2 uppercase text-cyber-red">Remove</button>
            </form>
          ))}
        </div>
      </Panel>
    </MailShell>
  );
}
