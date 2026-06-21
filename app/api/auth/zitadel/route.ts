import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

function createCsrfToken(secret: string) {
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(`${token}${secret}`).digest("hex");

  return {
    token,
    cookieValue: `${token}|${hash}`,
  };
}

function getSafeCallbackUrl(request: NextRequest) {
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") || "/dashboard";

  if (callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
    return callbackUrl;
  }

  return "/dashboard";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: NextRequest) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret) {
    return new NextResponse("Auth secret is not configured", { status: 500 });
  }

  const { token, cookieValue } = createCsrfToken(secret);
  const callbackUrl = getSafeCallbackUrl(request);
  const action = "/api/auth/signin/zitadel";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redirecting to Zitadel</title>
  </head>
  <body style="background:#0a0a0f;color:#e0e0e0;font-family:monospace;display:grid;min-height:100vh;place-items:center;">
    <form id="signin" action="${action}" method="post">
      <input type="hidden" name="csrfToken" value="${escapeHtml(token)}" />
      <input type="hidden" name="callbackUrl" value="${escapeHtml(callbackUrl)}" />
      <button type="submit" style="border:1px solid #00f0ff;background:#00f0ff;color:#0a0a0f;padding:12px 16px;font-weight:700;text-transform:uppercase;">
        Continue to Zitadel
      </button>
    </form>
    <script>document.getElementById('signin').submit();</script>
  </body>
</html>`;

  const response = new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

  response.cookies.set("__Host-next-auth.csrf-token", cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });

  response.cookies.set("__Secure-next-auth.callback-url", new URL(callbackUrl, request.nextUrl.origin).toString(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });

  return response;
}
