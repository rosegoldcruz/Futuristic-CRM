import { NextRequest, NextResponse } from "next/server";

const NEXT_AUTH_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.callback-url",
  "__Secure-next-auth.callback-url",
  "next-auth.csrf-token",
  "__Host-next-auth.csrf-token",
  "next-auth.pkce.code_verifier",
  "__Secure-next-auth.pkce.code_verifier",
  "next-auth.state",
  "__Secure-next-auth.state",
  "next-auth.nonce",
  "__Secure-next-auth.nonce",
];

const AUTH_COOKIE_PREFIXES = [
  "next-auth.session-token.",
  "__Secure-next-auth.session-token.",
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

async function getEndSessionEndpoint(issuer: string): Promise<string> {
  try {
    const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
      cache: "no-store",
    });

    if (response.ok) {
      const metadata = (await response.json()) as {
        end_session_endpoint?: string;
      };

      if (metadata.end_session_endpoint) {
        return metadata.end_session_endpoint;
      }
    }
  } catch {
    // Local session clearing still happens if discovery is temporarily unavailable.
  }

  return `${issuer}/oidc/v1/end_session`;
}

function clearAuthCookies(request: NextRequest, response: NextResponse) {
  const cookieNames = new Set(NEXT_AUTH_COOKIE_NAMES);
  const isHttps = request.nextUrl.protocol === "https:";

  for (const cookie of request.cookies.getAll()) {
    if (AUTH_COOKIE_PREFIXES.some((prefix) => cookie.name.startsWith(prefix))) {
      cookieNames.add(cookie.name);
    }
  }

  for (const name of cookieNames) {
    response.cookies.set(name, "", {
      expires: new Date(0),
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: name.startsWith("__") || isHttps,
    });
  }
}

async function logout(request: NextRequest) {
  const issuer = normalizeBaseUrl(requireEnv("ZITADEL_ISSUER"));
  const clientId = requireEnv("ZITADEL_CLIENT_ID");
  const appBaseUrl = normalizeBaseUrl(requireEnv("APP_BASE_URL"));
  const endSessionEndpoint = await getEndSessionEndpoint(issuer);

  const logoutUrl = new URL(endSessionEndpoint);
  logoutUrl.searchParams.set("client_id", clientId);
  logoutUrl.searchParams.set("post_logout_redirect_uri", appBaseUrl);

  const response = NextResponse.redirect(logoutUrl, 303);
  clearAuthCookies(request, response);

  return response;
}

async function handleLogout(request: NextRequest) {
  try {
    return await logout(request);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Missing required env var:")
    ) {
      return new NextResponse(error.message, { status: 500 });
    }

    throw error;
  }
}

export async function GET(request: NextRequest) {
  return handleLogout(request);
}

export async function POST(request: NextRequest) {
  return handleLogout(request);
}
