"use client";

import { AppPrivyProvider } from "@/components/providers/privy-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AppPrivyProvider>{children}</AppPrivyProvider>;
}
