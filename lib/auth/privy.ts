import { verifyAccessToken } from "@privy-io/node";
import { cookies } from "next/headers";

export type PrivySession = {
  privyUserId: string;
};

export async function getPrivySession(): Promise<PrivySession | null> {
  const token = cookies().get("privy-token")?.value;
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const verificationKey = process.env.PRIVY_VERIFICATION_KEY;

  if (!token || !appId || !verificationKey) {
    return null;
  }

  try {
    const payload = await verifyAccessToken({
      access_token: token,
      app_id: appId,
      verification_key: verificationKey,
    });

    return { privyUserId: payload.user_id };
  } catch {
    return null;
  }
}
