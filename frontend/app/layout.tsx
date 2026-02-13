import "../globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vulpine Marketplace OS",
  description: "AEON x Vulpine – Advanced Efficient Optimized Network for contractors and materials.",
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
      <body className="h-full bg-bgDarkest text-textPrimary antialiased font-mono scan-lines">
        {children}
      </body>
    </html>
  );
}
