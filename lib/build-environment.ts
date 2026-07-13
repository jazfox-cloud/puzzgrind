export const APP_ENVIRONMENTS = ["local", "test", "preview", "staging", "production"] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

type BuildEnvironmentSource = Partial<
  Record<"BUILD_APP_ENV" | "NODE_ENV" | "VITEST" | "WORKERS_CI" | "WORKERS_CI_BRANCH", string | undefined>
>;

function isAppEnvironment(value: string | undefined): value is AppEnvironment {
  return APP_ENVIRONMENTS.includes(value as AppEnvironment);
}

/**
 * Resolves the environment once while the application artifact is being built.
 * Runtime Worker bindings must not be used for metadata or indexability.
 */
export function resolveBuildAppEnvironment(source: BuildEnvironmentSource = process.env): AppEnvironment {
  const explicit = source.BUILD_APP_ENV?.trim();

  if (explicit) {
    if (!isAppEnvironment(explicit)) {
      throw new Error(`Invalid BUILD_APP_ENV: ${explicit}`);
    }
    return explicit;
  }

  if (source.WORKERS_CI === "1") {
    const branch = source.WORKERS_CI_BRANCH?.trim();
    if (!branch) {
      throw new Error("WORKERS_CI_BRANCH is required when WORKERS_CI=1");
    }
    return branch === "main" ? "production" : "preview";
  }

  if (source.NODE_ENV === "test" || source.VITEST) return "test";

  // Local and unclassified builds fail safe: no Production canonical or indexing.
  return "local";
}

export function getBuildAppEnvironment(): AppEnvironment {
  return resolveBuildAppEnvironment(process.env);
}
