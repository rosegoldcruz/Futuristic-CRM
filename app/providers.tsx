"use client";

import { AppSessionProvider } from "@/components/providers/session-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AppSessionProvider>{children}</AppSessionProvider>;
}