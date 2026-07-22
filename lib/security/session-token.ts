export type SessionTokenPayload = {
  anonymousId: string;
  issuedAt: number;
  nonce: string;
  puzzleId: string;
  sessionId: string;
};

export type SessionTokenVerification =
  | { ok: true; payload: SessionTokenPayload }
  | { ok: false; reason: "expired" | "invalid" };

export async function createSessionToken(payload: SessionTokenPayload, secret: string): Promise<string> {
  const encoded = encodeBase64Url(encodeUtf8(JSON.stringify(payload)));
  return `${encoded}.${encodeBase64Url(await hmacSha256(encoded, secret))}`;
}

export async function verifySessionToken(token: string, secret: string, now: number): Promise<SessionTokenPayload | null> {
  const result = await verifySessionTokenDetailed(token, secret, now);
  return result.ok ? result.payload : null;
}

export async function verifySessionTokenDetailed(token: string, secret: string, now: number): Promise<SessionTokenVerification> {
  try {
    const [encoded, signature, extra] = token.split(".");
    if (!encoded || !signature || extra) return { ok: false, reason: "invalid" };
    const expected = await hmacSha256(encoded, secret);
    const actual = decodeBase64Url(signature);
    if (!constantTimeEqual(actual, expected)) return { ok: false, reason: "invalid" };
    const payload = JSON.parse(decodeUtf8(decodeBase64Url(encoded))) as SessionTokenPayload;
    if (
      typeof payload.sessionId !== "string" || !payload.sessionId ||
      typeof payload.puzzleId !== "string" || !payload.puzzleId ||
      typeof payload.anonymousId !== "string" || !payload.anonymousId ||
      typeof payload.nonce !== "string" || !payload.nonce ||
      !Number.isInteger(payload.issuedAt)
    ) {
      return { ok: false, reason: "invalid" };
    }
    if (payload.issuedAt > now + 60) return { ok: false, reason: "invalid" };
    if (now - payload.issuedAt > 7 * 24 * 60 * 60) return { ok: false, reason: "expired" };
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
import {
  constantTimeEqual,
  decodeBase64Url,
  decodeUtf8,
  encodeBase64Url,
  encodeUtf8,
  hmacSha256,
} from "@/lib/security/hmac";
