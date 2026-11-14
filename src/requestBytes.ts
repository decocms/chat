import "server-only";

export class RequestBytesError extends Error {
  constructor(readonly reason: "empty" | "limit" | "length") {
    super("Invalid request body");
  }
}

/** Bound raw HTTP uploads before allocating their complete body. Headers are
 * only an early rejection; actual streamed bytes remain authoritative. */
export async function requestBytes(
  request: Request,
  maximum: number,
): Promise<ArrayBuffer> {
  if (!Number.isSafeInteger(maximum) || maximum < 1)
    throw Error("Invalid request byte limit");
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximum)) {
    await request.body?.cancel().catch(() => {});
    throw new RequestBytesError(/^\d+$/.test(length) ? "limit" : "length");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RequestBytesError("empty");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      if (part.value.byteLength > maximum - size)
        throw new RequestBytesError("limit");
      size += part.value.byteLength;
      chunks.push(new Uint8Array(part.value));
    }
    if (!size) throw new RequestBytesError("empty");
    const output = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return output.buffer;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
