import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import { getPrisma } from "@/lib/prisma";

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

      await prisma.user.upsert({
        where: { email },
        update: {
          zitadelUserId,
          name: user.name ?? undefined,
          lastLoginAt: new Date(),
        },
        create: {
          email,
          zitadelUserId,
          name: user.name ?? undefined,
          status: "PENDING",
          lastLoginAt: new Date(),
        },
      });

      return true;
    },
  },
});