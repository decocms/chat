// The call recorder's Worker. The chat asks it to record a room's call (POST /start, with the secret that the two
// share). It starts one container for that room (container/main.ts): a browser that joins the call, records it,
// converts the file and sends it to Grain.
import { Container } from "@cloudflare/containers";

type Env = {
  RECORDER: DurableObjectNamespace<Recorder>;
  /** The same value as the chat's RECORDER_SECRET. */
  RECORDER_SECRET: string;
  /** A Grain access token (the uploads go to that account). */
  GRAIN_API_TOKEN: string;
  /** Workers AI: the speech-to-text of the call's audio (Whisper). */
  AI: Ai;
};
/** `attempt`: 0 at the start of a call, more when the chat asks again in the same call (a new container each time). */
type Job = { room: string; joinUrl: string; attempt?: number; recorder?: string; title?: string };
const WHISPER = "@cf/openai/whisper-large-v3-turbo";
/** One part of the audio: 5 minutes of mono mp3 at 32 kbps is about 1.2 MB. */
const AUDIO_MAX = 6_000_000;

export class Recorder extends Container<Env> {
  defaultPort = 8080;
  // The container gets one request (the job) and then works alone for as long as the call lasts. It stops by
  // itself when its work ends; this is only the ceiling, over Grain's 3 hours for one file.
  sleepAfter = "4h";
  enableInternet = true;

  constructor(ctx: ConstructorParameters<typeof Container<Env>>[0], env: Env) {
    super(ctx, env);
    this.envVars = { GRAIN_API_TOKEN: env.GRAIN_API_TOKEN, RECORDER_SECRET: env.RECORDER_SECRET };
  }

  /** Starts the container and gives it the job. 409: this room's call is being recorded already. */
  async record(job: Job): Promise<number> {
    await this.startAndWaitForPorts();
    const res = await this.containerFetch("http://container/record", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(job),
    });
    return res.status;
  }
}

const same = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

function base64(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || !["/start", "/transcribe"].includes(url.pathname)) return new Response("not found", { status: 404 });
    if (!env.RECORDER_SECRET || !same(request.headers.get("authorization") ?? "", `Bearer ${env.RECORDER_SECRET}`)) return new Response("forbidden", { status: 403 });
    if (url.pathname === "/transcribe") {
      // From the container: one part of the call's audio. The answer: its pieces of text, with their times.
      // vad_filter: the model drops the parts with no voice first. Without it, it writes words for silence
      // (the first production recording had nobody speaking and six lines of "Thank you.", 2026-11-24).
      const audio = new Uint8Array(await request.arrayBuffer());
      if (!audio.byteLength || audio.byteLength > AUDIO_MAX) return new Response("audio empty or too large", { status: 413 });
      const out = (await env.AI.run(WHISPER, { audio: base64(audio), vad_filter: true })) as { transcription_info?: { language?: string }; segments?: { start?: number; end?: number; text?: string; no_speech_prob?: number }[] };
      return Response.json({
        language: out.transcription_info?.language ?? "",
        // `quiet`: how sure the model is that the piece has no speech. It writes words for noise at times.
        segments: (out.segments ?? []).map((piece) => ({ start: Number(piece.start) || 0, end: Number(piece.end) || 0, text: String(piece.text ?? ""), quiet: Number(piece.no_speech_prob) || 0 })),
      });
    }
    const job = (await request.json().catch(() => null)) as Partial<Job> | null;
    if (!job || typeof job.room !== "string" || !/^[a-z0-9]{6,40}$/.test(job.room) || typeof job.joinUrl !== "string" || !/^https?:\/\//.test(job.joinUrl)) return new Response("bad request", { status: 400 });
    const attempt = Number.isInteger(job.attempt) ? Number(job.attempt) : 0;
    // One container for each start: a recorder that still sends its file to Grain does not hold the next one.
    const status = await env.RECORDER.get(env.RECORDER.idFromName(`${job.room}:${attempt}`)).record({ room: job.room, joinUrl: job.joinUrl, recorder: url.origin, ...(typeof job.title === "string" ? { title: job.title.slice(0, 200) } : {}) });
    return Response.json({ status }, { status: status === 202 ? 200 : 502 });
  },
} satisfies ExportedHandler<Env>;
