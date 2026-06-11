"use client";

import { PrivyProvider } from "@privy-io/react-auth";

export function AppPrivyProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    return (
      <div className="min-h-screen bg-black p-8 text-red-400">
        Missing required env var: NEXT_PUBLIC_PRIVY_APP_ID
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email"],
        appearance: {
          theme: "dark",
          accentColor: "#00F0FF",
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

export const VulpinePrivyProvider = AppPrivyProvider;
