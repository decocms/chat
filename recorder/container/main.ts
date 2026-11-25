// The recorder of one call. It runs in a container (../src/index.ts starts it and posts the job to /record).
// A Chromium without a window opens the room as the room's recorder (a link that the chat signed), joins the call
// as the page does for any person, and records what a person would see and hear. When the people leave, ffmpeg
// makes the mp4 that Grain takes, the file goes to Grain, and the chat gets the link for the room.
// Plain Node 24 (it runs .ts by type stripping): only types that can be erased.
import { spawn } from "node:child_process";
import { appendFileSync, openAsBlob, readdirSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { chromium, type Page } from "playwright-core";
import { addMark, attribute, UNKNOWN, type Piece, type Turn } from "./attribute.ts";

/** `recorder`: the address of the recorder's Worker, which has the speech-to-text (POST /transcribe). */
type Job = { room: string; joinUrl: string; recorder?: string; title?: string };
const GRAIN = "https://api.grain.com/_/public-api/v2/";
const RAW = "/tmp/call.webm", OUT = "/tmp/call.mp4";
/** The audio goes to the speech-to-text in parts of this many seconds (about 1.2 MB each). */
const PART_S = 300;
/** Nobody but the recorder for this long: the call is over. */
const ALONE_S = 15;
/** Grain takes 3 hours in one file. */
const MAX_S = 3 * 3600 - 120;
const log = (...parts: unknown[]) => console.log(new Date().toISOString(), ...parts);

/** In the page: mixes the voices, draws the frame (the screen, or who speaks) and records the two. */
function recordInPage() {
  const w = window as unknown as { pcs: RTCPeerConnection[]; recorderChunk(data: string): Promise<void>; recorderStop?: () => Promise<{ names: string[]; marks: [string, number][] }> };
  const pc = w.pcs.at(-1);
  if (!pc) throw new Error("the call's connection was not found");
  const audio = new AudioContext(), mix = audio.createMediaStreamDestination(), heard = new Set<string>();
  void audio.resume();
  // A silent source keeps the mix alive while nobody talks.
  const idle = audio.createGain(), tone = audio.createOscillator();
  idle.gain.value = 0;
  tone.connect(idle).connect(mix);
  tone.start();
  const W = 1280, H = 720;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  const names = new Set<string>();
  // Who speaks, each 200 ms, in milliseconds from the start of the recording: the transcript's names come from it.
  const marks: [string, number][] = [];
  let began = 0;
  type Person = { name: string; speaking: boolean; cam: HTMLVideoElement | null; face: HTMLImageElement | null };
  const people = (): Person[] =>
    [...document.querySelectorAll<HTMLElement>("[data-call-tile], [data-call-people] li")]
      .map((el) => {
        const cam = el.querySelector<HTMLVideoElement>("video"), face = el.querySelector<HTMLImageElement>("img");
        return {
          name: (el.innerText || "").trim().split("\n")[0] ?? "",
          speaking: el.hasAttribute("data-speaking") || !!el.querySelector("[data-speaking]"),
          cam: cam && cam.videoWidth ? cam : null,
          face: face && face.complete && face.naturalWidth ? face : null,
        };
      })
      .filter((p) => p.name);
  const hue = (name: string) => [...name].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 360, 7);
  // A person: the camera when it is on, else the picture or a colored disc with the initial. Green = speaking.
  function draw(p: Person, cx: number, cy: number, size: number) {
    if (!ctx) return;
    ctx.save();
    if (p.cam) {
      const w0 = (size * 16) / 9, s = Math.max(w0 / p.cam.videoWidth, size / p.cam.videoHeight);
      ctx.beginPath();
      ctx.roundRect(cx - w0 / 2, cy - size / 2, w0, size, 16);
      ctx.clip();
      ctx.drawImage(p.cam, cx - (p.cam.videoWidth * s) / 2, cy - (p.cam.videoHeight * s) / 2, p.cam.videoWidth * s, p.cam.videoHeight * s);
      ctx.restore();
      ctx.save();
      if (p.speaking) {
        ctx.lineWidth = Math.max(4, size / 40);
        ctx.strokeStyle = "#3ddc68";
        ctx.beginPath();
        ctx.roundRect(cx - w0 / 2, cy - size / 2, w0, size, 16);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.save();
      ctx.clip();
      if (p.face) ctx.drawImage(p.face, cx - size / 2, cy - size / 2, size, size);
      else {
        ctx.fillStyle = `hsl(${hue(p.name)} 55% 38%)`;
        ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
        ctx.fillStyle = "#fff";
        ctx.font = `600 ${size * 0.45}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((p.name[0] ?? "").toUpperCase(), cx, cy + size * 0.03);
      }
      ctx.restore();
      if (p.speaking) {
        ctx.lineWidth = Math.max(4, size / 24);
        ctx.strokeStyle = "#3ddc68";
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.fillStyle = p.speaking ? "#3ddc68" : "#ddd";
    ctx.font = `${Math.max(18, size / 9)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(p.name, cx, cy + size / 2 + 10);
  }
  let last = "";
  const timer = setInterval(() => {
    for (const r of pc.getReceivers())
      if (r.track.kind === "audio" && !heard.has(r.track.id)) {
        heard.add(r.track.id);
        audio.createMediaStreamSource(new MediaStream([r.track])).connect(mix);
      }
    const who = people();
    who.forEach((p) => names.add(p.name));
    if (began) for (const p of who) if (p.speaking) marks.push([p.name, Math.round(performance.now() - began)]);
    // On the stage: who speaks now, else who spoke last.
    last = who.find((p) => p.speaking)?.name ?? (who.some((p) => p.name === last) ? last : (who[0]?.name ?? ""));
    const main = who.find((p) => p.name === last), rest = who.filter((p) => p !== main);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, W, H);
    const screen = [...document.querySelectorAll<HTMLVideoElement>("[data-call-stage] video:not([data-call-cam])")].find((v) => v.videoWidth > 0);
    if (screen) {
      // The shared screen takes the frame; the people go in a column at the right, the speaker first.
      const aw = W - 200, s = Math.min(aw / screen.videoWidth, H / screen.videoHeight), dw = screen.videoWidth * s, dh = screen.videoHeight * s;
      ctx.drawImage(screen, (aw - dw) / 2, (H - dh) / 2, dw, dh);
      [...(main ? [main] : []), ...rest].slice(0, 4).forEach((p, i) => draw({ ...p, cam: null }, W - 100, 90 + i * 170, 110));
    } else if (main) {
      draw(main, W / 2, rest.length ? 290 : 330, main.cam ? 400 : 300);
      const shown = rest.slice(0, 6), gap = Math.min(190, (W - 80) / Math.max(shown.length, 1));
      shown.forEach((p, i) => draw(p, W / 2 + (i - (shown.length - 1) / 2) * gap, 610, 90));
    }
  }, 200);
  const stream = new MediaStream([...canvas.captureStream(5).getVideoTracks(), ...mix.stream.getAudioTracks()]);
  const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus", videoBitsPerSecond: 600_000, audioBitsPerSecond: 64_000 });
  // Each second of the recording leaves the page at once: a long call does not stay in the page's memory.
  let sent = Promise.resolve();
  recorder.ondataavailable = (event) => {
    sent = sent.then(async () => {
      const bytes = new Uint8Array(await event.data.arrayBuffer());
      let text = "";
      for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      await w.recorderChunk(btoa(text));
    });
  };
  recorder.start(1000);
  began = performance.now();
  w.recorderStop = async () => {
    clearInterval(timer);
    await new Promise<void>((done) => {
      recorder.onstop = () => done();
      recorder.stop();
    });
    await sent;
    return { names: [...names], marks };
  };
}

const humans = (page: Page) => page.evaluate(() => document.querySelectorAll("[data-call-tile], [data-call-people] li").length);

function run(command: string, args: string[]) {
  return new Promise<void>((done, fail) => {
    const child = spawn(command, args, { stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", fail);
    child.on("exit", (code) => (code === 0 ? done() : fail(new Error(`${command} exited with ${code}`))));
  });
}

async function grain(method: string, path: string, body?: unknown) {
  const res = await fetch(GRAIN + path, {
    method,
    headers: { authorization: `Bearer ${process.env.GRAIN_API_TOKEN}`, "public-api-version": "2026-10-01", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new Error(`grain ${path} ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as Record<string, unknown>;
}

/** The mp4 goes to Grain; answers the recording's address there. */
async function toGrain(title: string, started: Date, names: string[], lines: Line[], language: string) {
  // With our transcript, Grain shows each person's name. Without it, Grain transcribes and names nobody.
  const key = (name: string) => `p${[...new Set([...names, UNKNOWN])].indexOf(name)}`;
  const spoke = lines.some((line) => line.name === UNKNOWN) ? [...names, UNKNOWN] : names;
  const made = (await grain("POST", "uploads/create", {
    media_type: "video",
    attributes: {
      title,
      start_datetime: started.toISOString(),
      ...(spoke.length ? { participants: spoke.map((name) => ({ name: name === UNKNOWN ? "Desconhecido" : name, ...(lines.length ? { speaker_key: key(name) } : {}) })) } : {}),
      ...(lines.length ? { transcript: { language, segments: lines.map((line) => ({ speaker_key: key(line.name), start: Math.round(line.start), end: Math.round(line.end), text: line.text })) } } : {}),
    },
  })) as { id: string; media: { upload: { url: string; headers?: Record<string, string> } } };
  const file = await openAsBlob(OUT);
  const put = await fetch(made.media.upload.url, { method: "PUT", headers: made.media.upload.headers ?? {}, body: file });
  if (!put.ok) throw new Error(`grain upload ${put.status}`);
  for (let i = 0; i < 80; i++) {
    await new Promise((done) => setTimeout(done, 15_000));
    const upload = (await grain("POST", `uploads/${made.id}`, {})) as { status?: string; recording_id?: string | null };
    if (upload.status === "failure") throw new Error("grain refused the file");
    if (upload.recording_id) return String((await grain("POST", `recordings/${upload.recording_id}`, {})).url ?? "");
  }
  throw new Error("grain did not finish in 20 minutes");
}

type Line = { name: string; start: number; end: number; text: string };

/** The call's words with who said them: the audio in parts to the Worker's speech-to-text, then the names from
 *  the page's marks. Any failure: no lines (Grain then transcribes by itself). */
async function transcribe(job: Job, marks: [string, number][], names: string[]): Promise<{ lines: Line[]; language: string }> {
  if (!job.recorder) return { lines: [], language: "pt" };
  try {
    for (const old of readdirSync("/tmp").filter((file) => file.startsWith("part-"))) rmSync(`/tmp/${old}`);
    await run("ffmpeg", ["-v", "error", "-y", "-i", RAW, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", "-f", "segment", "-segment_time", String(PART_S), "/tmp/part-%04d.mp3"]);
    const parts = readdirSync("/tmp").filter((file) => file.startsWith("part-")).sort();
    const pieces: Piece[] = [];
    let language = "";
    for (const [index, part] of parts.entries()) {
      const res = await fetch(`${job.recorder}/transcribe`, { method: "POST", headers: { authorization: `Bearer ${process.env.RECORDER_SECRET}` }, body: await openAsBlob(`/tmp/${part}`) });
      if (!res.ok) throw new Error(`transcribe ${res.status}`);
      const out = (await res.json()) as { language?: string; segments?: { start: number; end: number; text: string; quiet?: number }[] };
      language ||= out.language ?? "";
      for (const piece of out.segments ?? []) pieces.push({ start: (index * PART_S + piece.start) * 1000, end: (index * PART_S + piece.end) * 1000, text: piece.text, quiet: piece.quiet ?? 0 });
    }
    const turns: Turn[] = [];
    for (const [name, at] of marks) addMark(turns, name, at);
    return { lines: attribute(turns, pieces, names), language: language || "pt" };
  } catch (error) {
    log("no transcript of ours:", String(error));
    return { lines: [], language: "pt" };
  }
}

/** Tells the chat how the recording ended (POST /api/calls/recorded). */
const tell = (origin: string, body: unknown) =>
  fetch(`${origin}/api/calls/recorded`, { method: "POST", headers: { authorization: `Bearer ${process.env.RECORDER_SECRET}`, "content-type": "application/json" }, body: JSON.stringify(body) })
    .then((res) => log("the room was told:", res.status))
    .catch((error) => log("the room was not told:", String(error)));

async function record(job: Job) {
  const origin = new URL(job.joinUrl).origin;
  rmSync(RAW, { force: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || undefined,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
      // A test against a chat on plain http (local development): the microphone needs a secure page.
      ...(origin.startsWith("http://") ? [`--unsafely-treat-insecure-origin-as-secure=${origin}`] : []),
    ],
  });
  try {
    const context = await browser.newContext({ locale: "pt-BR", viewport: { width: 1280, height: 800 }, permissions: ["microphone"] });
    await context.addInitScript(() => {
      // Every connection the page makes, by its first negotiation.
      // The method has two signatures (one is the old callback form): this wraps the one that the page uses.
      type SetLocal = (this: RTCPeerConnection, description?: RTCLocalSessionDescriptionInit) => Promise<void>;
      const w = window as unknown as { pcs: RTCPeerConnection[] }, proto = RTCPeerConnection.prototype as unknown as { setLocalDescription: SetLocal }, original = proto.setLocalDescription;
      w.pcs = [];
      proto.setLocalDescription = function (description) {
        if (!w.pcs.includes(this)) w.pcs.push(this);
        return original.call(this, description);
      };
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => log("page exception:", String(error).slice(0, 300)));
    page.on("console", (message) => {
      if (message.type() === "error") log("page error:", message.text().slice(0, 300));
    });
    await page.exposeFunction("recorderChunk", (data: string) => appendFileSync(RAW, Buffer.from(data, "base64")));
    await page.goto(job.joinUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    if (await page.getByRole("dialog").count()) await page.keyboard.press("Escape");
    // The page joins by itself (microphone off) while a call is on. No call any more: nothing to record.
    try {
      await page.waitForFunction(() => (window as unknown as { pcs: RTCPeerConnection[] }).pcs.at(-1)?.connectionState === "connected", null, { timeout: 90_000 });
    } catch (error) {
      // What the page shows, to tell "no call any more" from a page that did not load or did not join.
      const seen = await page.evaluate(() => ({ url: location.pathname, pcs: (window as unknown as { pcs: RTCPeerConnection[] }).pcs.map((pc) => pc.connectionState), stage: !!document.querySelector("[data-call-stage]"), bar: !!document.querySelector("[data-call-bar]"), text: document.body.innerText.replace(/\s+/g, " ").slice(0, 300) })).catch(() => null);
      log("did not join the call:", JSON.stringify(seen));
      // People are still in the call (the page shows them) and the recorder is not: the room must know.
      if (seen?.bar || seen?.stage) throw error;
      return;
    }
    const started = new Date(), title = job.title || (await page.title()).replace(/\s*·\s*deco\.chat$/, "") || job.room;
    await page.evaluate(recordInPage);
    log("recording", job.room);
    let alone = 0, seconds = 0;
    for (; seconds < MAX_S && alone < ALONE_S; seconds++) {
      await page.waitForTimeout(1000);
      alone = (await humans(page)) ? 0 : alone + 1;
    }
    const { names, marks } = await page.evaluate(() => (window as unknown as { recorderStop(): Promise<{ names: string[]; marks: [string, number][] }> }).recorderStop());
    await browser.close();
    log("call over after", seconds, "s, people:", names.join(", "));
    // Grain takes 10 seconds or more.
    if (seconds - alone < 12) return log("too short to send");
    // Grain refuses the browser's file as it is (tested 2026-11-24): H.264 main, yuv420p, 30 frames, stereo AAC.
    await run("ffmpeg", ["-v", "error", "-y", "-i", RAW, "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "main", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", OUT]);
    log("mp4", statSync(OUT).size, "bytes");
    const { lines, language } = await transcribe(job, marks, names);
    log("transcript lines:", lines.length);
    // The title is where the call was (the room and the thread). Grain shows the date, and that it is a call.
    const url = await toGrain(title, started, names, lines, language);
    log("in Grain:", url);
    await tell(origin, { room: job.room, url, minutes: (seconds - alone) / 60, people: names, transcript: lines.map((line) => ({ name: line.name === UNKNOWN ? "Desconhecido" : line.name, start: line.start / 1000, text: line.text.slice(0, 4000) })) });
  } catch (error) {
    // The room is told only when people could count on the recording: the recorder was in the call, or they are.
    log("failed:", String(error));
    await tell(origin, { room: job.room, error: String(error).slice(0, 280) });
  } finally {
    await browser.close().catch(() => {});
  }
}

let busy = false;
createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/record") {
    response.writeHead(request.url === "/health" ? 200 : 404).end("ok");
    return;
  }
  let text = "";
  request.on("data", (part) => (text += part));
  request.on("end", () => {
    if (busy) return void response.writeHead(409).end("busy");
    let job: Job;
    try {
      job = JSON.parse(text);
    } catch {
      return void response.writeHead(400).end("bad request");
    }
    busy = true;
    response.writeHead(202).end("recording");
    // One call for each container: when the work ends, the process ends and the container stops.
    record(job)
      .catch((error) => log("failed:", String(error)))
      .finally(() => process.exit(0));
  });
}).listen(8080, () => log("recorder ready"));
