import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import { getPrisma } from "@/lib/prisma";

function getBootstrapAdminEmail() {
  return process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase();
}

function isBootstrapAdmin(email: string) {
  const bootstrapEmail = getBootstrapAdminEmail();
  return Boolean(bootstrapEmail && email === bootstrapEmail);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      const email = user.email?.toLowerCase();
      if (!email) {
        return false;
      }

      const zitadelUserId =
        account?.providerAccountId ??
        (typeof profile?.sub === "string" ? profile.sub : undefined);

      if (!zitadelUserId) {
        return false;
      }

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
    },
  },
});