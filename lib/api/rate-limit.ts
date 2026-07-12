import { NextResponse } from "next/server";

export type RateLimitBinding = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

export const RATE_LIMIT_POLICIES = {
  hint: { binding: "RATE_LIMIT_HINT", limit: 12, period: 60 },
  sessionComplete: { binding: "RATE_LIMIT_COMPLETE", limit: 6, period: 60 },
  sessionSave: { binding: "RATE_LIMIT_SAVE", limit: 60, period: 60 },
  sessionStart: { binding: "RATE_LIMIT_START", limit: 12, period: 60 },
  share: { binding: "RATE_LIMIT_SHARE", limit: 10, period: 60 },
  shareImage: { binding: "RATE_LIMIT_SHARE_IMAGE", limit: 120, period: 60 },
} as const;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;

function clientIp(request: Request): string {
  // CF-Connecting-IP is set by Cloudflare at the trusted edge. Do not fall back
  // to user-controlled forwarding headers.
  return request.headers.get("cf-connecting-ip")?.trim() || "unknown";
}

export function rateLimitKey(request: Request, policy: RateLimitPolicyName, identity?: string): string {
  const safeIdentity = identity?.slice(0, 128) || "anonymous";
  return `${policy}:${clientIp(request)}:${safeIdentity}`;
}

export async function enforceRateLimit(input: {
  binding?: RateLimitBinding;
  envName?: string;
  key: string;
  period: number;
}): Promise<NextResponse | null> {
  if (!input.binding) {
    if (input.envName === "production" || input.envName === "staging") {
      return NextResponse.json({ error: "rate_limiter_unavailable" }, { status: 503 });
    }
    return null;
  }

  try {
    const result = await input.binding.limit({ key: input.key });
    if (result.success) return null;
    return NextResponse.json(
      { error: "rate_limit_exceeded" },
      { status: 429, headers: { "Retry-After": String(input.period) } },
    );
  } catch {
    return NextResponse.json({ error: "rate_limiter_unavailable" }, { status: 503 });
  }
}

export async function limitApiRequest(
  request: Request,
  env: CloudflareEnv,
  policyName: RateLimitPolicyName,
  identity?: string,
): Promise<NextResponse | null> {
  const policy = RATE_LIMIT_POLICIES[policyName];
  const binding = env[policy.binding] as RateLimitBinding | undefined;
  return enforceRateLimit({
    binding,
    envName: env.APP_ENV,
    key: rateLimitKey(request, policyName, identity),
    period: policy.period,
  });
}
