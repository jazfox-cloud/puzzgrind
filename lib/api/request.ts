import { NextResponse } from "next/server";

// Limits are intentionally close to the real Phase 0 payload sizes. They prevent
// oversized bodies from being buffered and parsed by the Worker.
export const JSON_BODY_LIMITS = {
  hint: 1_024,
  sessionComplete: 8_192,
  sessionSave: 8_192,
  sessionStart: 256,
  share: 512,
} as const;

type JsonReadResult<T> =
  | { ok: true; value: T }
  | { ok: false; response: NextResponse };

function errorResponse(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function readJsonBody<T>(request: Request, maxBytes: number): Promise<JsonReadResult<T>> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      return { ok: false, response: errorResponse("payload_too_large", 413) };
    }
  }

  if (!request.body) return { ok: false, response: errorResponse("invalid_json", 400) };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        void reader.cancel().catch(() => undefined);
        return { ok: false, response: errorResponse("payload_too_large", 413) };
      }
      chunks.push(value);
    }

    if (totalBytes === 0) return { ok: false, response: errorResponse("invalid_json", 400) };
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) as T };
  } catch {
    return { ok: false, response: errorResponse("invalid_json", 400) };
  }
}
