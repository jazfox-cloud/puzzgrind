import type { NextConfig } from "next";

import { resolveBuildAppEnvironment } from "./lib/build-environment";

const buildAppEnvironment = resolveBuildAppEnvironment(process.env);

const deploymentSensitiveCacheHeaders = [
  { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
  { key: "CDN-Cache-Control", value: "no-store" },
  { key: "Cloudflare-CDN-Cache-Control", value: "no-store" },
];

// Freeze the environment into both prerendered output and the dynamic server bundle.
// This prevents runtime APP_ENV bindings from changing metadata for an existing artifact.
process.env.BUILD_APP_ENV = buildAppEnvironment;

const nextConfig: NextConfig = {
  async headers() {
    return ["/", "/privacy", "/robots.txt", "/sitemap.xml"].map((source) => ({
      source,
      headers: deploymentSensitiveCacheHeaders,
    }));
  },
  env: {
    BUILD_APP_ENV: buildAppEnvironment,
  },
  webpack(config, { webpack }) {
    config.plugins.push(
      new webpack.DefinePlugin({
        __PUZZGRIND_BUILD_APP_ENV__: JSON.stringify(buildAppEnvironment),
      }),
    );
    return config;
  },
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {},
};

export default nextConfig;
