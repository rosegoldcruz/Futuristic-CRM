import { requireActiveUser } from "@/lib/auth/access";
import { addContactToList, createList, removeContactFromList } from "@/lib/mail/actions";
import { getOptions } from "@/lib/mail/data";
import { getPrisma } from "@/lib/prisma";
import { Field, inputClass, MailShell, Panel } from "@/components/mail/ui";
import { Button } from "@/components/ui/button";

export default async function ListsPage() {
  const user = await requireActiveUser();
  const options = await getOptions();
  const lists = await getPrisma().$queryRaw<Array<{ id: string; name: string; description: string | null; members: bigint }>>`
    SELECT l.id::text, l.name, l.description, count(m.id) AS members
    FROM email_lists l
    LEFT JOIN email_list_members m ON m.list_id = l.id
    GROUP BY l.id
    ORDER BY l.created_at DESC
  `;
  const memberships = await getPrisma().$queryRaw<Array<{ list_id: string; contact_id: string; email: string; name: string | null }>>`
    SELECT m.list_id::text, c.id::text AS contact_id, c.email, c.full_name AS name
    FROM email_list_members m
    JOIN email_contacts c ON c.id = m.contact_id
    ORDER BY m.created_at DESC
    LIMIT 500
  `;
  return (
    <MailShell user={user} title="Lists">
      <Panel title="Create List">
        <form action={createList} className="grid gap-3 md:grid-cols-[1fr_2fr_140px]">
          <Field label="Name"><input name="name" required className={inputClass()} /></Field>
          <Field label="Description"><input name="description" className={inputClass()} /></Field>
          <Button type="submit">Create</Button>
        </form>
      </Panel>
      <Panel title="List Membership">
        <form action={addContactToList} className="grid gap-3 md:grid-cols-[1fr_1fr_160px]">
          <Field label="List"><select name="list_id" required className={inputClass()}>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></Field>
          <Field label="Contact"><select name="contact_id" required className={inputClass()}>{options.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></Field>
          <Button type="submit">Add Contact</Button>
        </form>
      </Panel>
      <Panel title="Lists">
        <div className="space-y-4">
          {lists.map((list) => (
            <div key={list.id} className="border border-borderSubtle bg-bgDark p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-sm uppercase text-textPrimary">{list.name}</h2>
                  <p className="text-xs text-textSecondary">{list.description}</p>
                </div>
                <span className="text-xs text-cyber-cyan">{Number(list.members)} members</span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {memberships.filter((member) => member.list_id === list.id).map((member) => (
                  <form key={`${list.id}-${member.contact_id}`} action={removeContactFromList} className="flex items-center justify-between gap-3 border border-borderSubtle px-3 py-2 text-xs">
                    <input type="hidden" name="list_id" value={list.id} />
                    <input type="hidden" name="contact_id" value={member.contact_id} />
                    <span>{member.name || member.email}</span>
                    <button type="submit" className="text-cyber-red">Remove</button>
                  </form>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </MailShell>
  );
}
