import "./globals.css";

import { Analytics } from "@/lib/analytics/Analytics";
import { getAnalyticsMeasurementId } from "@/lib/analytics/config";
import { createRootMetadata, getAppEnvironment } from "@/lib/seo";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return createRootMetadata(getAppEnvironment());
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const environment = getAppEnvironment();
  return (
    <html lang="en">
      <body>{children}</body>
      <Analytics environment={environment} measurementId={getAnalyticsMeasurementId()} />
    </html>
  );
}
