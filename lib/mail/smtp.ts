import { execFile } from "node:child_process";
import { promisify } from "node:util";
import nodemailer from "nodemailer";

const execFileAsync = promisify(execFile);

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
  error?: string;
};

export type MailTransportStatus = {
  available: boolean;
  mode: "smtp_env" | "sendmail" | "missing";
  message: string;
};

function parseBooleanEnv(name: string, value: string | undefined): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value == null || value === "") return null;
  throw new Error(`Missing required env var: ${name}`);
}

async function hasSendmail() {
  try {
    await execFileAsync("sh", ["-lc", "command -v sendmail"]);
    return true;
  } catch {
    return false;
  }
}

export async function getMailTransportStatus(): Promise<MailTransportStatus> {
  if (process.env.SMTP_HOST || process.env.SMTP_PORT || process.env.SMTP_SECURE) {
    if (!process.env.SMTP_HOST) return { available: false, mode: "missing", message: "Missing required env var: SMTP_HOST" };
    if (!process.env.SMTP_PORT) return { available: false, mode: "missing", message: "Missing required env var: SMTP_PORT" };
    if (parseBooleanEnv("SMTP_SECURE", process.env.SMTP_SECURE) === null) {
      return { available: false, mode: "missing", message: "Missing required env var: SMTP_SECURE" };
    }
    return { available: true, mode: "smtp_env", message: "Explicit SMTP env transport configured" };
  }

  if (await hasSendmail()) {
    return { available: true, mode: "sendmail", message: "Local sendmail transport available" };
  }

  return {
    available: false,
    mode: "missing",
    message: "Missing required mail transport: SMTP env vars or local sendmail",
  };
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  try {
    const status = await getMailTransportStatus();
    if (!status.available) return { ok: false, error: status.message };

    const from = input.from || process.env.SMTP_FROM;
    if (!from) return { ok: false, error: "Missing required env var: SMTP_FROM" };

    const transport =
      status.mode === "smtp_env"
        ? nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: parseBooleanEnv("SMTP_SECURE", process.env.SMTP_SECURE) ?? false,
            auth:
              process.env.SMTP_USER && process.env.SMTP_PASS
                ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
                : undefined,
          })
        : nodemailer.createTransport({ sendmail: true });

    const result = await transport.sendMail({
      to: input.to,
      from,
      replyTo: input.replyTo || process.env.SMTP_REPLY_TO,
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
