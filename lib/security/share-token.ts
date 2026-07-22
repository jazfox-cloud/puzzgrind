export type ShareTokenPayload = {
  durationSeconds: number;
  hintCount: number;
  issuedAt: number;
  maxHintLevel: 0 | 1 | 2 | 3;
  mistakes: number;
  puzzleDate: string;
};

async function signature(value: string, secret: string): Promise<Uint8Array> {
  return hmacSha256(`puzzgrind-share-v1.${value}`, secret);
}

function validPayload(payload: ShareTokenPayload): boolean {
  return /^\d{4}-\d{2}-\d{2}$/u.test(payload.puzzleDate) &&
    Number.isInteger(payload.durationSeconds) && payload.durationSeconds >= 1 && payload.durationSeconds <= 86400 &&
    Number.isInteger(payload.mistakes) && payload.mistakes >= 0 && payload.mistakes <= 999 &&
    Number.isInteger(payload.hintCount) && payload.hintCount >= 0 && payload.hintCount <= 999 &&
    Number.isInteger(payload.maxHintLevel) && payload.maxHintLevel >= 0 && payload.maxHintLevel <= 3 &&
    Number.isInteger(payload.issuedAt) && payload.issuedAt > 0;
}

export async function createShareToken(payload: ShareTokenPayload, secret: string): Promise<string> {
  if (!validPayload(payload)) throw new Error("Invalid share payload");
  const encoded = encodeBase64Url(encodeUtf8(JSON.stringify(payload)));
  return `${encoded}.${encodeBase64Url(await signature(encoded, secret))}`;
}

export async function verifyShareToken(token: string, secret: string): Promise<ShareTokenPayload | null> {
  try {
    const [encoded, supplied, extra] = token.split(".");
    if (!encoded || !supplied || extra) return null;
    const expected = await signature(encoded, secret);
    const actual = decodeBase64Url(supplied);
    if (!constantTimeEqual(actual, expected)) return null;
    const payload = JSON.parse(decodeUtf8(decodeBase64Url(encoded))) as ShareTokenPayload;
    return validPayload(payload) ? payload : null;
  } catch {
    return null;
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
