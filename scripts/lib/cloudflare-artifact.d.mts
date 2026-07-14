export type ArtifactEnvironment = "preview" | "staging" | "production";
export type ArtifactMarker = {
  environment: ArtifactEnvironment;
  gitSha: string;
  schemaVersion: 1;
  buildId: string;
  files: Record<string, string>;
};

export const ARTIFACT_ENVIRONMENTS: ArtifactEnvironment[];
export const MARKER_PATH: string;
export function cleanArtifacts(root?: string): void;
export function resolveGitSha(root?: string, source?: NodeJS.ProcessEnv): string;
export function finalizeArtifact(options: { environment: ArtifactEnvironment; gitSha: string; root?: string }): ArtifactMarker;
export function validateArtifact(options: { environment: ArtifactEnvironment; expectedGitSha: string; root?: string }): ArtifactMarker;
