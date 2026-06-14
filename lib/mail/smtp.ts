import nodemailer from "nodemailer";
import { getMailConfigStatus, getOutboundMailConfig } from "@/lib/mail/config";

export type SendEmailInput = {
  to: string;
  from?: string;
  replyTo?: string;
  subject: string;
  html?: string;
  text?: string;
};

export type SendEmailResult = {
  ok: boolean;
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
  response?: string;
  dryRun?: boolean;
  error?: string;
};

export type MailTransportStatus = {
  available: boolean;
  mode: "smtp" | "dry_run" | "missing";
  message: string;
};

function formatFrom(email: string, name?: string | null) {
  return name ? `"${name.replace(/"/g, "'")}" <${email}>` : email;
}

export async function getMailTransportStatus(): Promise<MailTransportStatus> {
  return getMailConfigStatus() as MailTransportStatus;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  try {
    const config = getOutboundMailConfig();
    const from = input.from || formatFrom(config.from, config.fromName);
    const replyTo = input.replyTo || config.replyTo || undefined;

    if (config.mode === "dry_run") {
      return {
        ok: true,
        dryRun: true,
        messageId: `dry-run-${Date.now()}`,
        accepted: [input.to],
        rejected: [],
        response: "Dry-run mail mode enabled; no real email sent",
      };
    }

    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });

    const result = await transport.sendMail({
      to: input.to,
      from,
      replyTo,
      subject: input.subject,
      html: input.html || undefined,
      text: input.text || undefined,
    });

    return {
      ok: true,
      messageId: result.messageId,
      accepted: result.accepted?.map(String),
      rejected: result.rejected?.map(String),
      response: result.response,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown send failure" };
  }
}
