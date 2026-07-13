import "./globals.css";

import { createRootMetadata, getAppEnvironment } from "@/lib/seo";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return createRootMetadata(getAppEnvironment());
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
