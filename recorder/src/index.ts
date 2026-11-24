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
};
type Job = { room: string; joinUrl: string };

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/start") return new Response("not found", { status: 404 });
    if (!env.RECORDER_SECRET || !same(request.headers.get("authorization") ?? "", `Bearer ${env.RECORDER_SECRET}`)) return new Response("forbidden", { status: 403 });
    const job = (await request.json().catch(() => null)) as Partial<Job> | null;
    if (!job || typeof job.room !== "string" || !/^[a-z0-9]{6,40}$/.test(job.room) || typeof job.joinUrl !== "string" || !/^https?:\/\//.test(job.joinUrl)) return new Response("bad request", { status: 400 });
    const status = await env.RECORDER.get(env.RECORDER.idFromName(job.room)).record({ room: job.room, joinUrl: job.joinUrl });
    return Response.json({ status }, { status: status === 202 || status === 409 ? 200 : 502 });
  },
} satisfies ExportedHandler<Env>;
