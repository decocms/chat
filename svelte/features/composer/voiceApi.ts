import { client } from "../../lib/client/api";
import type { FetchLike } from "../../transport";
import { SttResult, ErrorBody, UNAUTHENTICATED } from "../../../shared/schemas";
export class VoiceFailure extends Error {
  constructor(
    readonly status: number,
    readonly unauthenticated = false,
    readonly membershipDenied = false,
  ) {
    super("Transcription request failed");
  }
}
type VoiceResponse = { ok: boolean; status: number; json(): Promise<unknown> };
async function body(response: VoiceResponse) {
  const raw: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ErrorBody.safeParse(raw);
    throw new VoiceFailure(
      response.status,
      response.status === 401 &&
        error.success &&
        error.data.error === UNAUTHENTICATED.error,
      response.status === 403 &&
        error.success &&
        error.data.error === "forbidden",
    );
  }
  return raw;
}
export function createVoiceApi(fetcher?: FetchLike) {
  const api = client("/", fetcher).api.books[":id"];
  return {
    async transcribe(
      roomId: string,
      audio: Blob,
      query: { lang: string; prompt: string },
      signal: AbortSignal,
    ) {
      const response = await api.stt.$post(
        { param: { id: encodeURIComponent(roomId) }, query },
        {
          init: {
            signal,
            cache: "no-store",
            body: audio,
            headers: { "content-type": audio.type || "audio/webm" },
          },
        },
      );
      try {
        return SttResult.parse(await body(response)).text;
      } catch (error) {
        if (error instanceof VoiceFailure) throw error;
        throw new VoiceFailure(0);
      }
    },
  };
}
