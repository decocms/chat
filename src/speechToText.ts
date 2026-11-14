import "server-only";
import * as z from "zod/mini";
import { STT_AUDIO_MAX, SttResult, type SttQuery } from "../shared/schemas";
export const WHISPER_MODEL = "@cf/openai/whisper-large-v3-turbo";
const WhisperOutput = z.object({
  text: z.optional(z.string().check(z.maxLength(65536))),
});
export class SpeechAudioError extends Error {
  constructor() {
    super("audio empty or over 4 MB");
  }
}
/** Bound bytes while reading, including chunked bodies without Content-Length. */
export async function speechAudio(
  request: Request,
  maxBytes = STT_AUDIO_MAX,
): Promise<Uint8Array<ArrayBuffer>> {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    await request.body?.cancel().catch(() => {});
    throw new SpeechAudioError();
  }
  const reader = request.body?.getReader();
  if (!reader) throw new SpeechAudioError();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) throw new SpeechAudioError();
      chunks.push(new Uint8Array(part.value));
    }
    if (!size) throw new SpeechAudioError();
    const output = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) {
      output.set(chunk, at);
      at += chunk.byteLength;
    }
    return output;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
function audioBase64(audio: Uint8Array) {
  // Complete three-byte groups keep padding confined to the final chunk and
  // bound argument count without importing Node types into the API project.
  let output = "";
  for (let at = 0; at < audio.length; at += 24576)
    output += btoa(String.fromCharCode(...audio.subarray(at, at + 24576)));
  return output;
}
function whisperInput(audio: Uint8Array, query: SttQuery) {
  return {
    audio: audioBase64(audio),
    language: (query.lang || "pt").slice(0, 5),
    initial_prompt: (query.prompt ?? "vibebook").slice(0, 600),
    vad_filter: true,
  };
}
/** The Workers AI result is untrusted at runtime even when its SDK declaration is narrower. */
export async function transcribeSpeech(
  audio: Uint8Array,
  query: SttQuery,
  run: (input: ReturnType<typeof whisperInput>) => Promise<unknown>,
) {
  const output = WhisperOutput.parse(await run(whisperInput(audio, query)));
  return SttResult.parse({ ok: true, text: (output.text ?? "").trim() });
}
