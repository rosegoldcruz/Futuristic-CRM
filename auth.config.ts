import type { NextAuthConfig } from "next-auth";
import { getZitadelProviders } from "@/lib/auth/zitadel-env";

export default {
  trustHost: true,
  providers: getZitadelProviders(),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
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
} satisfies NextAuthConfig;