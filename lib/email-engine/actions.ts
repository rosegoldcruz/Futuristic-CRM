"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserOrThrow } from "@/lib/auth/access";
import {
  approveCampaign,
  cancelQueueItem,
  generateCampaignRecipients,
  queueCampaign,
  retryQueueItem,
} from "@/lib/email-engine";

const EMAIL_ENGINE_PATHS = [
  "/email-engine/overview",
  "/email-engine/campaigns",
  "/email-engine/queue",
  "/email-engine/compliance",
];

function refreshEmailEngine() {
  EMAIL_ENGINE_PATHS.forEach((path) => revalidatePath(path));
}

function required(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} is required`);
  return value.trim();
}

export async function approveCampaignAction(formData: FormData) {
  const actor = await getCurrentUserOrThrow();
  await approveCampaign(required(formData, "campaign_id"), actor);
  refreshEmailEngine();
}

export async function generateCampaignRecipientsAction(formData: FormData) {
  const actor = await getCurrentUserOrThrow();
  await generateCampaignRecipients(required(formData, "campaign_id"), actor);
  refreshEmailEngine();
}

export async function queueCampaignAction(formData: FormData) {
  const actor = await getCurrentUserOrThrow();
  await queueCampaign(required(formData, "campaign_id"), actor);
  refreshEmailEngine();
}

export async function retryQueueItemAction(formData: FormData) {
  const actor = await getCurrentUserOrThrow();
  await retryQueueItem(required(formData, "queue_id"), actor);
  refreshEmailEngine();
}

export async function cancelQueueItemAction(formData: FormData) {
  const actor = await getCurrentUserOrThrow();
  await cancelQueueItem(required(formData, "queue_id"), actor);
  refreshEmailEngine();
}
