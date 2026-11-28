// A local stand-in for the recorder Worker (recorder/src/index.ts), for "Test the call locally" (docs/workflow.md).
// It takes the chat's POST /start and gives the job to the recorder's container, which runs in Docker on this
// computer. POST /transcribe calls Workers AI with the same input as the Worker. Run it with:
//   RECORDER_SECRET=<as in .dev.vars> CF_TOKEN=<a Cloudflare token that can run Workers AI> bun scripts/call-recorder-local.ts
const secret = process.env.RECORDER_SECRET ?? "";
const token = process.env.CF_TOKEN ?? "";
const account = process.env.CF_ACCOUNT_ID ?? "c95fc4cec7fc52453228d9db170c372c";
const port = Number(process.env.PORT ?? 8790);
const container = process.env.RECORDER_CONTAINER ?? "http://127.0.0.1:8789";
if (!secret || !token) throw new Error("Set RECORDER_SECRET and CF_TOKEN");

type Whisper = { result?: { transcription_info?: { language?: string }; segments?: { start: number; end: number; text: string; no_speech_prob?: number }[] } };

Bun.serve({
  port,
  hostname: "0.0.0.0",
  async fetch(request) {
    if (request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("forbidden", { status: 403 });
    const path = new URL(request.url).pathname;
    if (path === "/transcribe") {
      const audio = Buffer.from(await request.arrayBuffer()).toString("base64");
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/openai/whisper-large-v3-turbo`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ audio, vad_filter: true }),
      });
      const out = ((await res.json()) as Whisper).result ?? {};
      console.log("transcribe", res.status, (out.segments ?? []).length, "pieces");
      // Each piece with how sure the model is that it has no speech: to tune the filter for invented words.
      for (const piece of out.segments ?? [])
        console.log("  piece", out.transcription_info?.language ?? "", (piece.no_speech_prob ?? 0).toFixed(3), JSON.stringify(piece.text.trim().slice(0, 80)));
      return Response.json({
        language: out.transcription_info?.language ?? "",
        segments: (out.segments ?? []).map((piece) => ({ start: piece.start, end: piece.end, text: piece.text, quiet: piece.no_speech_prob ?? 0 })),
      });
    }
    if (path !== "/start") return new Response("not found", { status: 404 });
    // The container reaches this stand-in through Docker's host name.
    const job = { ...((await request.json()) as object), recorder: `http://host.docker.internal:${port}` };
    const res = await fetch(`${container}/record`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(job) });
    console.log("start", res.status);
    return Response.json({ status: res.status }, { status: res.status === 202 ? 200 : 502 });
  },
});
console.log(`recorder stand-in on http://127.0.0.1:${port}`);
