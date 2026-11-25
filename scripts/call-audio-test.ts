// What the other side of a call hears when the person who speaks has noise around them. One person "speaks" a
// fixed test audio through the microphone (scripts/fixtures/call-noise.wav: Portuguese speech with pauses, mixed
// with construction, keyboard and a voice in the back); the other records what arrives. The script saves both
// audios and measures them (docs/workflow.md, "Test the call's audio").
//
// The measure needs no alignment: the audio is cut in 100 ms windows. The quietest 10% are the noise that is left
// in the pauses ("noise floor"); the loudest 10% are the speech. The gap between the two, in dB, is how far the
// speech stands out from the noise. A better noise suppression gives a lower noise floor and a bigger gap.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { $ } from "bun";
import { chromium, type Page } from "playwright";

const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:8797";
assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base), "Use a loopback test Worker with DEV_EMAIL enabled");
const output = process.env.TEST_OUTPUT_DIR ?? "/tmp/vibebook-call-audio";
const input = resolve(process.env.TEST_AUDIO ?? "scripts/fixtures/call-noise.wav");
const seconds = Number(process.env.TEST_SECONDS ?? 20);
const label = process.env.TEST_LABEL ?? "received";
// Live: a person speaks from their own browser, with the noise around them; the script is only the listener.
const live = process.env.TEST_LIVE === "1";
// TEST_DENOISE=0: the speaker has the noise suppression (RNNoise) off, to compare with it on.
const denoise = process.env.TEST_DENOISE !== "0";
await mkdir(output, { recursive: true });

/** Noise floor, speech level and their gap (dB), from 16 kHz mono 16-bit PCM. */
export function levels(pcm: Int16Array, rate = 16000) {
  const size = rate / 10, rms: number[] = [];
  for (let at = 0; at + size <= pcm.length; at += size) {
    let sum = 0;
    for (let i = at; i < at + size; i++) sum += (pcm[i]! / 32768) ** 2;
    rms.push(Math.sqrt(sum / size));
  }
  const sorted = rms.toSorted((a, b) => a - b), pick = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  const db = (x: number) => Math.round(20 * Math.log10(Math.max(x, 1e-6)) * 10) / 10;
  const floor = db(pick(0.1)), speech = db(pick(0.9));
  return { noise_floor_db: floor, speech_db: speech, gap_db: Math.round((speech - floor) * 10) / 10 };
}
const measure = async (file: string) => {
  const raw = await $`ffmpeg -v error -i ${file} -ac 1 -ar 16000 -f s16le -`.arrayBuffer();
  return levels(new Int16Array(raw));
};

const browser = await chromium.launch({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", ...(live ? [] : [`--use-file-for-fake-audio-capture=${input}`])],
});
async function person(email: string) {
  const context = await browser.newContext({ locale: "pt-BR", viewport: { width: 1280, height: 800 }, permissions: ["microphone"] });
  await context.addInitScript((on) => localStorage.setItem("vb-call-denoise", on ? "1" : "0"), denoise);
  await context.addInitScript(() => {
    // Every connection the page makes, so the test can record what arrives.
    type SetLocal = (this: RTCPeerConnection, description?: RTCLocalSessionDescriptionInit) => Promise<void>;
    const w = window as unknown as { pcs: RTCPeerConnection[] }, proto = RTCPeerConnection.prototype as unknown as { setLocalDescription: SetLocal }, original = proto.setLocalDescription;
    w.pcs = [];
    proto.setLocalDescription = function (description) {
      if (!w.pcs.includes(this)) w.pcs.push(this);
      return original.call(this, description);
    };
  });
  const page = await context.newPage();
  await page.goto(`${base}/api/dev/as?email=${encodeURIComponent(email)}`);
  return page;
}
const post = (page: Page, path: string, body: unknown) =>
  page.evaluate(async ([to, json]) => (await fetch(to as string, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(json) })).text(), [path, body] as const);

try {
  const ana = await person("ana@example.com"), bia = await person("bia@example.com");
  const room = JSON.parse(await post(ana, "/api/books", { title: "Teste de áudio" })).id as string;
  await post(ana, `/api/books/${room}/members`, { email: "bia@example.com" });
  await post(bia, `/api/books/${room}/invite`, { yes: true });
  if (live) {
    // The person opens the room as Ana in their own browser and starts the call; Bia (here) listens.
    await ana.close();
    await bia.goto(`${base}/b/${room}`);
    console.log(`\nOpen in your browser, in this order:\n  ${base}/api/dev/as?email=ana%40example.com\n  ${base}/b/${room}\nThen click "Iniciar call" and speak, with the noise around you, for ${seconds} seconds.\n`);
  } else {
    await Promise.all([ana.goto(`${base}/b/${room}`), bia.goto(`${base}/b/${room}`)]);
    await ana.waitForTimeout(1500);
    if (await ana.getByRole("dialog").count()) await ana.keyboard.press("Escape");
    // Ana starts the call (microphone on) and speaks the test audio.
    await ana.getByRole("button", { name: /Iniciar call/ }).first().click();
  }
  await bia.waitForTimeout(1500);
  if (await bia.getByRole("dialog").count()) await bia.keyboard.press("Escape");
  // Bia joins by herself, microphone off.
  await bia.getByRole("button", { name: "Ativar o microfone" }).first().waitFor({ timeout: live ? 10 * 60_000 : 30_000 });
  await bia.waitForFunction(() => (window as unknown as { pcs: RTCPeerConnection[] }).pcs.at(-1)?.getReceivers().some((r) => r.track.kind === "audio" && r.track.readyState === "live"), null, { timeout: 30_000 });
  await bia.waitForTimeout(2000);
  const data = await bia.evaluate(async (ms) => {
    const pc = (window as unknown as { pcs: RTCPeerConnection[] }).pcs.at(-1)!;
    const tracks = pc.getReceivers().filter((r) => r.track.kind === "audio").map((r) => r.track);
    // Through the audio graph, as a speaker would play it: Chrome gives a recorder nothing from a remote track
    // that is not played.
    const audio = new AudioContext(), mix = audio.createMediaStreamDestination();
    await audio.resume();
    for (const track of tracks) audio.createMediaStreamSource(new MediaStream([track])).connect(mix);
    const recorder = new MediaRecorder(mix.stream, { mimeType: "audio/webm;codecs=opus" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.start(500);
    await new Promise((done) => setTimeout(done, ms));
    await new Promise<void>((done) => {
      recorder.onstop = () => done();
      recorder.stop();
    });
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
    let text = "";
    for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(text);
  }, seconds * 1000);
  if (!live) {
    // The speaker's "Mais opções" menu, with the noise suppression switch.
    await ana.locator("[data-call-more]").first().click();
    await ana.locator("[data-call-denoise]").waitFor();
    await ana.waitForTimeout(500);
    await ana.screenshot({ path: `${output}/${label}-menu.png` });
  }
  const webm = `${output}/${label}.webm`, wav = `${output}/${label}.wav`;
  await writeFile(webm, Buffer.from(data, "base64"));
  await $`ffmpeg -v error -y -i ${webm} -ac 1 -ar 16000 ${wav}`;
  console.log(JSON.stringify({ room, ...(live ? {} : { input: { file: input, ...(await measure(input)) } }), [label]: { file: wav, denoise, ...(await measure(wav)) } }, null, 2));
} finally {
  await browser.close();
}
