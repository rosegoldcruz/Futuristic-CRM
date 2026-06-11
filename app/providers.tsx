"use client";

import { VulpinePrivyProvider } from "@/components/providers/privy-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <VulpinePrivyProvider>{children}</VulpinePrivyProvider>;
}
