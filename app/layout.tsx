import "../globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Vulpine Command Center",
  description: "Vulpine Command Center CRM shell.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Orbitron:wght@400;500;600;700;800;900&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="h-full bg-bgDarkest text-textPrimary antialiased font-mono">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
