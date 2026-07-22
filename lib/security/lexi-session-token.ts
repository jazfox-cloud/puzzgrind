import {
  constantTimeEqual, decodeBase64Url, decodeUtf8, encodeBase64Url,
  encodeUtf8, hmacSha256,
} from "./hmac";

export type LexiSessionTokenPayload = {
  anonymousId: string;
  expiresAt: number;
  issuedAt: number;
  nonce: string;
  puzzleId: string;
  scope: "lexi_daily";
  sessionId: string;
};

export type LexiTokenVerification =
  | { ok: true; payload: LexiSessionTokenPayload }
  | { ok: false; reason: "expired" | "invalid" };

export async function createLexiSessionToken(
  payload: Omit<LexiSessionTokenPayload, "scope">,
  secret: string,
): Promise<string> {
  const encoded = encodeBase64Url(encodeUtf8(JSON.stringify({ ...payload, scope: "lexi_daily" })));
  return `${encoded}.${encodeBase64Url(await hmacSha256(encoded, secret))}`;
}

export async function verifyLexiSessionToken(
  token: string, secret: string, now: number,
): Promise<LexiTokenVerification> {
  try {
    const [encoded, signature, extra] = token.split(".");
    if (!encoded || !signature || extra) return { ok: false, reason: "invalid" };
    const actual = decodeBase64Url(signature);
    const expected = await hmacSha256(encoded, secret);
    if (!constantTimeEqual(actual, expected)) return { ok: false, reason: "invalid" };
    const payload = JSON.parse(decodeUtf8(decodeBase64Url(encoded))) as Partial<LexiSessionTokenPayload>;
    if (payload.scope !== "lexi_daily" || typeof payload.sessionId !== "string" || !payload.sessionId ||
      typeof payload.puzzleId !== "string" || !payload.puzzleId || typeof payload.anonymousId !== "string" ||
      !payload.anonymousId || typeof payload.nonce !== "string" || !payload.nonce ||
      !Number.isInteger(payload.issuedAt) || !Number.isInteger(payload.expiresAt) ||
      (payload.issuedAt as number) > now + 60 || (payload.expiresAt as number) <= (payload.issuedAt as number)) {
      return { ok: false, reason: "invalid" };
    }
    if (now >= (payload.expiresAt as number)) return { ok: false, reason: "expired" };
    return { ok: true, payload: payload as LexiSessionTokenPayload };
  } catch { return { ok: false, reason: "invalid" }; }
}
