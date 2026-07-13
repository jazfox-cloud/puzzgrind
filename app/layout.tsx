import "./globals.css";

import { Analytics } from "@/lib/analytics/Analytics";
import { getAnalyticsMeasurementId } from "@/lib/analytics/config";
import { getBuildAppEnvironment } from "@/lib/build-environment";
import { createRootMetadata } from "@/lib/seo";

export function generateMetadata() {
  return createRootMetadata(getBuildAppEnvironment());
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const environment = getBuildAppEnvironment();
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics environment={environment} measurementId={getAnalyticsMeasurementId()} />
      </body>
    </html>
  );
}
