"use client";

import { PrivyProvider } from "@privy-io/react-auth";

export function VulpinePrivyProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google"],
        appearance: {
          theme: "dark",
          accentColor: "#00f0ff",
          logo: undefined,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
