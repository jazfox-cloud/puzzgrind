import type { NextConfig } from "next";

import { resolveBuildAppEnvironment } from "./lib/build-environment";

const buildAppEnvironment = resolveBuildAppEnvironment(process.env);

// Freeze the environment into both prerendered output and the dynamic server bundle.
// This prevents runtime APP_ENV bindings from changing metadata for an existing artifact.
process.env.BUILD_APP_ENV = buildAppEnvironment;

const nextConfig: NextConfig = {
  env: {
    BUILD_APP_ENV: buildAppEnvironment,
  },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
