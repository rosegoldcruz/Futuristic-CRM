import type { Provider } from "next-auth/providers";
import Zitadel from "next-auth/providers/zitadel";

export function isZitadelConfigured() {
  return Boolean(
    process.env.ZITADEL_ISSUER &&
      process.env.ZITADEL_CLIENT_ID &&
      process.env.ZITADEL_CLIENT_SECRET
  );
}

export function getZitadelProviders(): Provider[] {
  if (!isZitadelConfigured()) {
    return [];
  }

  return [
    Zitadel({
      clientId: process.env.ZITADEL_CLIENT_ID,
      clientSecret: process.env.ZITADEL_CLIENT_SECRET,
      issuer: process.env.ZITADEL_ISSUER,
    }),
  ];
}