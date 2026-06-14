"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserOrThrow } from "@/lib/auth/access";
import {
  addLeadNote,
  archiveLead,
  assignLead,
  convertLeadToContactAndCompany,
  createLead,
  updateLead,
  updateLeadStatus,
} from "@/lib/leads";

type ActionState = { ok: boolean; message: string };

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  const text = typeof raw === "string" ? raw.trim() : "";
  return text || null;
}

function required(formData: FormData, key: string) {
  const text = value(formData, key);
  if (!text) throw new Error(`${key} is required`);
  return text;
}

function leadInput(formData: FormData) {
  return {
    firstName: value(formData, "firstName"),
    lastName: value(formData, "lastName"),
    email: value(formData, "email"),
    phone: value(formData, "phone"),
    companyName: value(formData, "companyName"),
    title: value(formData, "title"),
    source: value(formData, "source"),
    campaign: value(formData, "campaign"),
    status: value(formData, "status"),
    interestLevel: value(formData, "interestLevel"),
    assignedTo: value(formData, "assignedTo"),
    estimatedValue: value(formData, "estimatedValue"),
    lastContactedAt: value(formData, "lastContactedAt"),
    nextFollowUpAt: value(formData, "nextFollowUpAt"),
    notes: value(formData, "notes"),
  };
}

function refreshLeads() {
  revalidatePath("/leads");
}

export async function createLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUserOrThrow();
  const result = await createLead(leadInput(formData), actor);
  refreshLeads();
  if (result.duplicate) return { ok: false, message: result.message ?? "Duplicate lead found" };
  return { ok: true, message: "Lead created" };
}

export async function updateLeadAction(formData: FormData) {
  const actor = await getCurrentUserOrThrow();
  await updateLead(required(formData, "id"), leadInput(formData), actor);
  refreshLeads();
}

export async function updateLeadStatusAction(formData: FormData) {
  const actor = await getCurrentUserOrThrow();
  await updateLeadStatus(required(formData, "id"), required(formData, "status"), actor);
  refreshLeads();
}

export async function assignLeadAction(formData: FormData) {
  const actor = await getCurrentUserOrThrow();
  await assignLead(required(formData, "id"), required(formData, "assignedTo"), actor);
  refreshLeads();
}

export async function addLeadNoteAction(formData: FormData) {
  const actor = await getCurrentUserOrThrow();
  await addLeadNote(required(formData, "id"), required(formData, "body"), actor);
  refreshLeads();
}

export async function convertLeadAction(formData: FormData) {
  const actor = await getCurrentUserOrThrow();
  await convertLeadToContactAndCompany(required(formData, "id"), actor);
  refreshLeads();
  revalidatePath("/email-engine/contacts");
  revalidatePath("/email-engine/companies");
}

export async function archiveLeadAction(formData: FormData) {
  const actor = await getCurrentUserOrThrow();
  await archiveLead(required(formData, "id"), actor);
  refreshLeads();
}
