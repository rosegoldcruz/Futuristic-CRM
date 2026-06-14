import type { Prisma } from "@prisma/client";
import type { AppUser } from "@/lib/auth/access";
import {
  addContactToList,
  addSuppression,
  approveCampaign,
  createCampaign,
  createCompany,
  createContact,
  createList,
  createTemplate,
  generateCampaignRecipients,
  queueCampaign,
  removeSuppression,
  retryQueueItem,
  cancelQueueItem,
} from "@/lib/email-engine";
import { triggerN8nWebhook } from "@/lib/automation";
import {
  addLeadNote,
  assignLead,
  convertLeadToContactAndCompany,
  createLead,
  listLeads,
  updateLead,
  updateLeadStatus,
} from "@/lib/leads";

export type CommandParams = Record<string, unknown>;

type RegisteredCommand = {
  description: string;
  run: (params: CommandParams, actor: AppUser) => Promise<unknown>;
};

function requiredString(params: CommandParams, key: string) {
  const value = params[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

function jsonPayload(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

export const registeredCommandActions: Record<string, RegisteredCommand> = {
  create_contact: {
    description: "Create or update an email contact.",
    run: (params, actor) => createContact(params, actor),
  },
  create_company: {
    description: "Create a company record.",
    run: (params, actor) => createCompany(params, actor),
  },
  create_list: {
    description: "Create an email audience list.",
    run: (params, actor) => createList(params, actor),
  },
  add_contact_to_list: {
    description: "Add a contact to an email list.",
    run: (params, actor) => addContactToList(requiredString(params, "list_id"), requiredString(params, "contact_id"), actor),
  },
  create_template: {
    description: "Create an email template.",
    run: (params, actor) => createTemplate(params, actor),
  },
  create_campaign: {
    description: "Create a campaign from a list and template.",
    run: (params, actor) => createCampaign(params, actor),
  },
  approve_campaign: {
    description: "Approve a campaign before queueing.",
    run: (params, actor) => approveCampaign(requiredString(params, "campaign_id"), actor),
  },
  generate_campaign_recipients: {
    description: "Generate campaign recipients from the selected list and template.",
    run: (params, actor) => generateCampaignRecipients(requiredString(params, "campaign_id"), actor),
  },
  queue_campaign: {
    description: "Create email queue jobs for a campaign.",
    run: (params, actor) => queueCampaign(requiredString(params, "campaign_id"), actor),
  },
  retry_queue_item: {
    description: "Return a failed queue item to queued state.",
    run: (params, actor) => retryQueueItem(requiredString(params, "queue_id"), actor),
  },
  cancel_queue_item: {
    description: "Cancel a queued email.",
    run: (params, actor) => cancelQueueItem(requiredString(params, "queue_id"), actor),
  },
  add_suppression: {
    description: "Add or update an email suppression.",
    run: (params, actor) => addSuppression(params, actor),
  },
  remove_suppression: {
    description: "Remove an email suppression.",
    run: (params, actor) => removeSuppression(requiredString(params, "suppression_id"), actor),
  },
  create_lead: {
    description: "Create a CRM lead.",
    run: (params, actor) => createLead(params, actor),
  },
  update_lead: {
    description: "Update a CRM lead.",
    run: (params, actor) => updateLead(requiredString(params, "lead_id"), params, actor),
  },
  update_lead_status: {
    description: "Update a CRM lead status.",
    run: (params, actor) => updateLeadStatus(requiredString(params, "lead_id"), requiredString(params, "status"), actor),
  },
  assign_lead: {
    description: "Assign a CRM lead.",
    run: (params, actor) => assignLead(requiredString(params, "lead_id"), requiredString(params, "assigned_to"), actor),
  },
  add_lead_note: {
    description: "Add a CRM lead note.",
    run: (params, actor) => addLeadNote(requiredString(params, "lead_id"), requiredString(params, "body"), actor),
  },
  convert_lead: {
    description: "Convert a CRM lead to contact/company records.",
    run: (params, actor) => convertLeadToContactAndCompany(requiredString(params, "lead_id"), actor),
  },
  list_leads: {
    description: "List CRM leads with filters.",
    run: (params) =>
      listLeads({
        search: typeof params.search === "string" ? params.search : undefined,
        status: typeof params.status === "string" ? params.status : undefined,
        source: typeof params.source === "string" ? params.source : undefined,
        campaign: typeof params.campaign === "string" ? params.campaign : undefined,
        assignedTo: typeof params.assigned_to === "string" ? params.assigned_to : undefined,
        interestLevel: typeof params.interest_level === "string" ? params.interest_level : undefined,
        limit: typeof params.limit === "number" ? params.limit : undefined,
        offset: typeof params.offset === "number" ? params.offset : undefined,
      }),
  },
  trigger_n8n_webhook: {
    description: "Trigger a configured n8n webhook path and record the automation run.",
    run: (params, actor) =>
      triggerN8nWebhook({
        path: requiredString(params, "path"),
        payload: jsonPayload(params.payload),
        actor,
      }),
  },
};

export async function executeRegisteredCommand(action: string, params: CommandParams, actor: AppUser) {
  const command = registeredCommandActions[action];
  if (!command) {
    throw new Error(`Unknown command action: ${action}`);
  }
  return command.run(params, actor);
}
