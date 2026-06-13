export type TemplateContact = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  companyName?: string | null;
  email?: string | null;
  title?: string | null;
};

const VARIABLE_PATTERN = /{{\s*(first_name|last_name|full_name|company_name|email|title)\s*}}/g;

export function renderTemplate(template: string | null | undefined, contact: TemplateContact) {
  const values: Record<string, string> = {
    first_name: contact.firstName ?? "",
    last_name: contact.lastName ?? "",
    full_name: contact.fullName ?? [contact.firstName, contact.lastName].filter(Boolean).join(" "),
    company_name: contact.companyName ?? "",
    email: contact.email ?? "",
    title: contact.title ?? "",
  };

  return (template ?? "").replace(VARIABLE_PATTERN, (_, key: string) => values[key] ?? "");
}

export function normalizeEmail(email: FormDataEntryValue | string | null | undefined) {
  return String(email ?? "").trim().toLowerCase();
}
