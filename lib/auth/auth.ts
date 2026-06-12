import type { NextAuthOptions } from "next-auth";
import { getPrisma } from "@/lib/prisma";

// Bootstrap admin email from env — only used on first sign-in
function getBootstrapAdminEmail() {
  return process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase();
}

function isBootstrapAdmin(email: string) {
  const bootstrapEmail = getBootstrapAdminEmail();
  return Boolean(bootstrapEmail && email === bootstrapEmail);
}

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
          {
            id: "zitadel",
            name: "Zitadel",
            type: "oauth",
            wellKnown: `${process.env.ZITADEL_ISSUER}/.well-known/openid-configuration`,
            clientId: process.env.ZITADEL_CLIENT_ID!,
            client: {
              token_endpoint_auth_method: "none",
            },
            authorization: {
              params: {
                scope: "openid email profile roles",
              },
            },
            profile(profile: any) {
              return {
                id: profile.sub,
                name: profile.name || profile.preferred_username || "User",
                email: profile.email || null,
                image: profile.picture || null,
              };
            },
          },
        ]
      : [],
    callbacks: {
      async signIn({ user, account, profile }) {
        const email = user.email?.toLowerCase();
        if (!email) return false;

        const zitadelUserId =
          account?.providerAccountId ??
          (typeof profile?.sub === "string" ? profile.sub : undefined);

        if (!zitadelUserId) return false;

        try {
          const prisma = getPrisma();
          const existingByZitadelId = await prisma.user.findUnique({
            where: { zitadelUserId },
            select: { id: true, email: true },
          });

          if (existingByZitadelId && existingByZitadelId.email !== email) {
            return false;
          }

          const bootstrapAdmin = isBootstrapAdmin(email);

          await prisma.user.upsert({
            where: { email },
            update: {
              zitadelUserId,
              name: user.name ?? undefined,
              lastLoginAt: new Date(),
              ...(bootstrapAdmin ? { role: "OWNER", status: "ACTIVE" } : {}),
            },
            create: {
              email,
              zitadelUserId,
              name: user.name ?? undefined,
              role: bootstrapAdmin ? "OWNER" : "USER",
              status: bootstrapAdmin ? "ACTIVE" : "PENDING",
              lastLoginAt: new Date(),
            },
          });

          return true;
        } catch {
          return false;
        }
      },
      async jwt({ token, user }) {
        if (user?.email) {
          token.email = user.email.toLowerCase();
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user && typeof token.email === "string") {
          session.user.email = token.email;
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
