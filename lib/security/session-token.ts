export type SessionTokenPayload = {
  anonymousId: string;
  issuedAt: number;
  nonce: string;
  puzzleId: string;
  sessionId: string;
};

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(value: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function createSessionToken(payload: SessionTokenPayload, secret: string): Promise<string> {
  const encoded = base64Url(encoder.encode(JSON.stringify(payload)));
  return `${encoded}.${base64Url(await hmac(encoded, secret))}`;
}

export async function verifySessionToken(token: string, secret: string, now: number): Promise<SessionTokenPayload | null> {
  try {
    const [encoded, signature, extra] = token.split(".");
    if (!encoded || !signature || extra) return null;
    const expected = await hmac(encoded, secret);
    const actual = decodeBase64Url(signature);
    if (actual.length !== expected.length) return null;
    let difference = 0;
    for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
    if (difference !== 0) return null;
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encoded))) as SessionTokenPayload;
    if (!payload.sessionId || !payload.puzzleId || !payload.anonymousId || !payload.nonce || !Number.isInteger(payload.issuedAt)) return null;
    if (payload.issuedAt > now + 60 || now - payload.issuedAt > 7 * 24 * 60 * 60) return null;
    return payload;
  } catch {
    return null;
  }
}
