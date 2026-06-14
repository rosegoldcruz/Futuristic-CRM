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

function leadId(formData: FormData) {
  const id = value(formData, "leadId") ?? value(formData, "id");
  if (!id) throw new Error("leadId is required");
  return id;
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

function validationMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Lead action failed";
}

function logUnexpected(action: string, error: unknown) {
  console.error(`[leads] ${action} failed`, error instanceof Error ? { message: error.message, stack: error.stack } : { error });
}

export async function createLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await getCurrentUserOrThrow();
    const result = await createLead(leadInput(formData), actor);
    refreshLeads();
    if (result.duplicate) return { ok: false, message: result.message ?? "Duplicate lead found" };
    return { ok: true, message: "Lead created" };
  } catch (error) {
    logUnexpected("createLeadAction", error);
    return { ok: false, message: validationMessage(error) };
  }
}

export async function updateLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await getCurrentUserOrThrow();
    const result = await updateLead(leadId(formData), leadInput(formData), actor);
    refreshLeads();
    if (result.duplicate) return { ok: false, message: result.message ?? "Duplicate lead found" };
    return { ok: true, message: "Lead saved" };
  } catch (error) {
    logUnexpected("updateLeadAction", error);
    return { ok: false, message: validationMessage(error) };
  }
}

export async function updateLeadStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await getCurrentUserOrThrow();
    await updateLeadStatus(leadId(formData), required(formData, "status"), actor);
    refreshLeads();
    return { ok: true, message: "Status updated" };
  } catch (error) {
    logUnexpected("updateLeadStatusAction", error);
    return { ok: false, message: validationMessage(error) };
  }
}

export async function assignLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await getCurrentUserOrThrow();
    await assignLead(leadId(formData), required(formData, "assignedTo"), actor);
    refreshLeads();
    return { ok: true, message: "Lead assigned" };
  } catch (error) {
    logUnexpected("assignLeadAction", error);
    return { ok: false, message: validationMessage(error) };
  }
}

export async function addLeadNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await getCurrentUserOrThrow();
    await addLeadNote(leadId(formData), required(formData, "body"), actor);
    refreshLeads();
    return { ok: true, message: "Note added" };
  } catch (error) {
    logUnexpected("addLeadNoteAction", error);
    return { ok: false, message: validationMessage(error) };
  }
}

export async function convertLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await getCurrentUserOrThrow();
    await convertLeadToContactAndCompany(leadId(formData), actor);
    refreshLeads();
    revalidatePath("/email-engine/contacts");
    revalidatePath("/email-engine/companies");
    return { ok: true, message: "Lead converted" };
  } catch (error) {
    logUnexpected("convertLeadAction", error);
    return { ok: false, message: validationMessage(error) };
  }
}

export async function archiveLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await getCurrentUserOrThrow();
    await archiveLead(leadId(formData), actor);
    refreshLeads();
    return { ok: true, message: "Lead archived" };
  } catch (error) {
    logUnexpected("archiveLeadAction", error);
    return { ok: false, message: validationMessage(error) };
  }
}
