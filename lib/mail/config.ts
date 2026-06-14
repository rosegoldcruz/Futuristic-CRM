export type OutboundMailConfig =
  | {
      mode: "dry_run";
      from: string;
      fromName: string | null;
      replyTo: string | null;
      trackingBaseUrl: string | null;
    }
  | {
      mode: "smtp";
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
      from: string;
      fromName: string | null;
      replyTo: string | null;
      trackingBaseUrl: string | null;
    };

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function missing(name: string): never {
  throw new Error(`Missing required env var: ${name}`);
}

function bool(name: string, fallback = false) {
  const value = env(name).toLowerCase();
  if (!value) return fallback;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  throw new Error(`Missing required env var: ${name}`);
}

function parsePort(value: string) {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("Missing required env var: SMTP_PORT");
  }
  return port;
}

function senderFromEnv() {
  return env("SMTP_FROM") || env("SMTP_FROM_EMAIL") || env("EMAIL_DEFAULT_FROM");
}

export function isDryRunMailMode() {
  return bool("EMAIL_DRY_RUN", false) || env("SEND_LAYER_PROVIDER").toUpperCase() === "DRY_RUN";
}

export function getOutboundMailConfig(): OutboundMailConfig {
  const from = senderFromEnv();
  const fromName = env("SMTP_FROM_NAME") || env("EMAIL_DEFAULT_FROM_NAME") || null;
  const replyTo = env("SMTP_REPLY_TO") || null;
  const trackingBaseUrl = env("EMAIL_TRACKING_BASE_URL") || env("APP_BASE_URL") || null;

  if (isDryRunMailMode()) {
    return {
      mode: "dry_run",
      from: from || "dry-run@localhost",
      fromName,
      replyTo,
      trackingBaseUrl,
    };
  }

  const host = env("SMTP_HOST") || missing("SMTP_HOST");
  const port = parsePort(env("SMTP_PORT") || missing("SMTP_PORT"));
  const user = env("SMTP_USER") || missing("SMTP_USER");
  const pass = env("SMTP_PASS") || missing("SMTP_PASS");
  const smtpFrom = from || missing("SMTP_FROM");

  return {
    mode: "smtp",
    host,
    port,
    secure: bool("SMTP_SECURE", false),
    user,
    pass,
    from: smtpFrom,
    fromName,
    replyTo,
    trackingBaseUrl,
  };
}

export function getMailConfigStatus() {
  try {
    const config = getOutboundMailConfig();
    return {
      available: true,
      mode: config.mode,
      message: config.mode === "dry_run" ? "Dry-run mail mode enabled; no real email will be sent" : "SMTP transport configured",
    };
  } catch (error) {
    return {
      available: false,
      mode: "missing",
      message: error instanceof Error ? error.message : "Missing required mail configuration",
    };
  }
}
