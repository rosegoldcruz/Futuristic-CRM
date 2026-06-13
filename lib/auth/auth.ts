import type { NextAuthOptions } from "next-auth";
import ZitadelProvider from "next-auth/providers/zitadel";
import type { OAuthUserConfig } from "next-auth/providers/oauth";
import type { ZitadelProfile } from "next-auth/providers/zitadel";

function isRequiredEnvConfigured(): boolean {
  return Boolean(
    process.env.ZITADEL_ISSUER &&
    process.env.ZITADEL_CLIENT_ID &&
    process.env.AUTH_SECRET
  );
}

export function getAuthOptions(): NextAuthOptions {
  const configured = isRequiredEnvConfigured();

  return {
    secret: process.env.AUTH_SECRET,
    providers: configured
      ? [
          ZitadelProvider({
            issuer: process.env.ZITADEL_ISSUER!,
            clientId: process.env.ZITADEL_CLIENT_ID!,
            client: {
              token_endpoint_auth_method: "none",
            },
            authorization: {
              params: {
                scope: "openid email profile roles",
              },
            },
          } as OAuthUserConfig<ZitadelProfile>),
        ]
      : [],
    callbacks: {
      async jwt({ token, user, account }) {
        if (user?.email) {
          token.email = user.email.toLowerCase();
        }
        if (account?.providerAccountId) {
          token.zitadelUserId = account.providerAccountId;
        } else if (typeof token.sub === "string") {
          token.zitadelUserId = token.sub;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user && typeof token.email === "string") {
          session.user.email = token.email;
        }
        if (session.user && typeof token.zitadelUserId === "string") {
          session.user.id = token.zitadelUserId;
        }
        return session;
      },
    },
    pages: {
      signIn: "/login",
      error: "/login",
    },
    session: {
      strategy: "jwt",
      maxAge: 30 * 24 * 60 * 60,
    },
  };
}
