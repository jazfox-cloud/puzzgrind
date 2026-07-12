export type ShareTokenPayload = {
  durationSeconds: number;
  hintCount: number;
  issuedAt: number;
  maxHintLevel: 0 | 1 | 2 | 3;
  mistakes: number;
  puzzleDate: string;
};

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function signature(value: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`puzzgrind-share-v1.${value}`)));
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
  const encoded = base64Url(encoder.encode(JSON.stringify(payload)));
  return `${encoded}.${base64Url(await signature(encoded, secret))}`;
}

export async function verifyShareToken(token: string, secret: string): Promise<ShareTokenPayload | null> {
  try {
    const [encoded, supplied, extra] = token.split(".");
    if (!encoded || !supplied || extra) return null;
    const expected = await signature(encoded, secret);
    const actual = decodeBase64Url(supplied);
    if (actual.length !== expected.length) return null;
    let difference = 0;
    for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
    if (difference !== 0) return null;
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encoded))) as ShareTokenPayload;
    return validPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}
