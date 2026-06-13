import { requireActiveUser } from "@/lib/auth/access";
import { sendSingleEmail } from "@/lib/mail/actions";
import { getMailTransportStatus } from "@/lib/mail/smtp";
import { StatefulForm } from "@/components/mail/form-state";
import { Badge, Field, inputClass, MailShell, Panel, textAreaClass } from "@/components/mail/ui";

export default async function SendPage() {
  const user = await requireActiveUser();
  const transport = await getMailTransportStatus();
  return (
    <MailShell user={user} title="Single Send">
      <Panel title="Transport">
        <Badge tone={transport.available ? "green" : "red"}>{transport.mode}</Badge>
        <p className="mt-3 text-sm text-textSecondary">{transport.message}</p>
      </Panel>
      <Panel title="Send One Email">
        <StatefulForm action={sendSingleEmail} submitLabel="Send Email">
          <Field label="To"><input name="to" type="email" required className={inputClass()} /></Field>
          <Field label="Subject"><input name="subject" required className={inputClass()} /></Field>
          <Field label="Text Body"><textarea name="text" className={textAreaClass()} /></Field>
          <Field label="HTML Body"><textarea name="html" className={textAreaClass()} /></Field>
        </StatefulForm>
      </Panel>
    </MailShell>
  );
}
