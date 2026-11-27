// A call with many people in one Chromium, against a loopback Worker with the real SFU (docs/workflow.md, "Test the
// call with many people"). TEST_PEOPLE join (default 30); everyone but TEST_SPEAKERS mutes. The speakers send the
// test audio (scripts/fixtures/call-noise.wav, the same file for each: they speak at the same time). The last person
// records what they hear, in two parts: one speaker, then all the speakers. Then the first person shares the screen.
// It prints the level that the listener hears (levels() of call-audio-test.ts), each person's received and sent
// kbps, lost packets, jitter and audio that the browser had to fill in (concealed), and the machine's CPU.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { $ } from "bun";
import { chromium, type Page } from "playwright";

const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:8797";
assert(
  /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base),
  "Use a loopback test Worker with DEV_EMAIL enabled",
);
const people = Number(process.env.TEST_PEOPLE ?? 30);
const speakers = Math.min(people - 1, Number(process.env.TEST_SPEAKERS ?? 3));
const seconds = Number(process.env.TEST_SECONDS ?? 15);
const output = process.env.TEST_OUTPUT_DIR ?? "/tmp/vibebook-call-load";
const input = resolve(
  process.env.TEST_AUDIO ?? "scripts/fixtures/call-noise.wav",
);
await mkdir(output, { recursive: true });

/** Noise floor, speech level and their gap (dB), from 16 kHz mono 16-bit PCM (as call-audio-test.ts). */
function levels(pcm: Int16Array, rate = 16000) {
  const size = rate / 10,
    rms: number[] = [];
  for (let at = 0; at + size <= pcm.length; at += size) {
    let sum = 0;
    for (let i = at; i < at + size; i++) sum += (pcm[i]! / 32768) ** 2;
    rms.push(Math.sqrt(sum / size));
  }
  const sorted = rms.toSorted((a, b) => a - b),
    pick = (q: number) =>
      sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  const db = (x: number) =>
    Math.round(20 * Math.log10(Math.max(x, 1e-6)) * 10) / 10;
  return { noise_floor_db: db(pick(0.1)), speech_db: db(pick(0.9)) };
}
const measure = async (file: string) =>
  levels(
    new Int16Array(
      await $`ffmpeg -v error -i ${file} -ac 1 -ar 16000 -f s16le -`.arrayBuffer(),
    ),
  );

/** macOS: the percent of memory that is free. Below MIN_FREE the test stops, before the system kills processes
 *  (a run of 30 people on a 16 GB Mac did that). */
const MIN_FREE = Number(process.env.TEST_MIN_FREE ?? 20);
const freeMemory = async () =>
  Number((await $`sysctl -n kern.memorystatus_level`.text()).trim()) || 100;
async function guard(step: string) {
  const free = await freeMemory();
  if (free < MIN_FREE)
    throw new Error(
      `stopped at ${step}: ${free}% of memory free (TEST_MIN_FREE=${MIN_FREE})`,
    );
  return free;
}

const browser = await chromium.launch({
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${input}`,
    "--auto-select-desktop-capture-source=Entire screen",
    // Many pages in one browser: the hidden ones must not slow down their timers and audio.
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
  ],
});
async function person(email: string) {
  const context = await browser.newContext({
    locale: "pt-BR",
    viewport: { width: 1280, height: 800 },
    permissions: ["microphone", "camera"],
  });
  if (process.env.TEST_DENOISE)
    await context.addInitScript(
      (on) => localStorage.setItem("vb-call-denoise", on),
      process.env.TEST_DENOISE,
    );
  await context.addInitScript(() => {
    // Every connection the page makes, so the test can read its stats and record what arrives.
    type SetLocal = (
      this: RTCPeerConnection,
      d?: RTCLocalSessionDescriptionInit,
    ) => Promise<void>;
    const w = window as unknown as { pcs: RTCPeerConnection[] },
      proto = RTCPeerConnection.prototype as unknown as {
        setLocalDescription: SetLocal;
      },
      original = proto.setLocalDescription;
    w.pcs = [];
    proto.setLocalDescription = function (d) {
      if (!w.pcs.includes(this)) w.pcs.push(this);
      return original.call(this, d);
    };
  });
  const page = await context.newPage();
  await page.goto(`${base}/api/dev/as?email=${encodeURIComponent(email)}`);
  return page;
}
const post = (page: Page, path: string, body: unknown) =>
  page.evaluate(
    async ([to, json]) =>
      (
        await fetch(to as string, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(json),
        })
      ).text(),
    [path, body] as const,
  );
const micButton = /Silenciar o microfone|Ativar o microfone/;
/** Mutes or unmutes, and waits until the button shows it (a click while the session starts can be lost). */
async function setMic(page: Page, on: boolean) {
  const [now, next] = on
    ? ["Ativar o microfone", "Silenciar o microfone"]
    : ["Silenciar o microfone", "Ativar o microfone"];
  for (let tries = 0; tries < 5; tries++) {
    if (await page.getByRole("button", { name: next }).count()) return;
    await page
      .getByRole("button", { name: now })
      .first()
      .dispatchEvent("click")
      .catch(() => {});
    await page.waitForTimeout(500);
  }
  throw new Error(`the microphone did not turn ${on ? "on" : "off"}`);
}

/** What a page's connection did since `before`: kbps in and out, lost packets, jitter, concealed audio. */
async function stats(page: Page) {
  return page.evaluate(async () => {
    const pc = (window as unknown as { pcs: RTCPeerConnection[] }).pcs.at(-1);
    const out = {
      inBytes: 0,
      outBytes: 0,
      lost: 0,
      packets: 0,
      jitter: 0,
      audioIn: 0,
      concealed: 0,
      samples: 0,
      at: performance.now(),
    };
    if (!pc) return out;
    (await pc.getStats()).forEach((s: Record<string, number | string>) => {
      if (s.type === "inbound-rtp") {
        out.inBytes += Number(s.bytesReceived ?? 0);
        out.lost += Number(s.packetsLost ?? 0);
        out.packets += Number(s.packetsReceived ?? 0);
        if (s.kind === "audio") {
          out.audioIn++;
          out.jitter = Math.max(out.jitter, Number(s.jitter ?? 0));
          out.concealed += Number(s.concealedSamples ?? 0);
          out.samples += Number(s.totalSamplesReceived ?? 0);
        }
      }
      if (s.type === "outbound-rtp") out.outBytes += Number(s.bytesSent ?? 0);
    });
    return out;
  });
}
type Stats = Awaited<ReturnType<typeof stats>>;
const rate = (a: Stats, b: Stats) => {
  const s = (b.at - a.at) / 1000;
  return {
    in_kbps: Math.round(((b.inBytes - a.inBytes) * 8) / s / 1000),
    out_kbps: Math.round(((b.outBytes - a.outBytes) * 8) / s / 1000),
    lost_pct: +(
      (100 * (b.lost - a.lost)) /
      Math.max(1, b.packets - a.packets + b.lost - a.lost)
    ).toFixed(2),
    jitter_ms: Math.round(b.jitter * 1000),
    concealed_pct: +(
      (100 * (b.concealed - a.concealed)) /
      Math.max(1, b.samples - a.samples)
    ).toFixed(2),
    voices: b.audioIn,
  };
};
/** The machine's CPU (percent of one core, summed over Chromium's processes) now. */
const cpu = async () =>
  (await $`ps -A -o %cpu=,comm=`.text())
    .split("\n")
    .filter((line) => /chrom|headless/i.test(line))
    .reduce((sum, line) => sum + (parseFloat(line) || 0), 0);

/** Records what `page` hears for `ms` and saves it as a wav: the level a speaker would play. */
async function record(page: Page, ms: number, name: string) {
  const data = await page.evaluate(async (ms) => {
    const pc = (window as unknown as { pcs: RTCPeerConnection[] }).pcs.at(-1)!;
    const tracks = pc
      .getReceivers()
      .filter((r) => r.track.kind === "audio" && r.track.readyState === "live")
      .map((r) => r.track);
    const audio = new AudioContext(),
      mix = audio.createMediaStreamDestination();
    await audio.resume();
    for (const track of tracks)
      audio.createMediaStreamSource(new MediaStream([track])).connect(mix);
    const recorder = new MediaRecorder(mix.stream, {
      mimeType: "audio/webm;codecs=opus",
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.start(500);
    await new Promise((done) => setTimeout(done, ms));
    await new Promise<void>((done) => {
      recorder.onstop = () => done();
      recorder.stop();
    });
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
    let text = "";
    for (let i = 0; i < bytes.length; i += 0x8000)
      text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(text);
  }, ms);
  const webm = `${output}/${name}.webm`,
    wav = `${output}/${name}.wav`;
  await writeFile(webm, Buffer.from(data, "base64"));
  await $`ffmpeg -v error -y -i ${webm} -ac 1 -ar 16000 ${wav}`;
  return measure(wav);
}

const result: Record<string, unknown> = {
  people,
  speakers,
  input: await measure(input),
};
try {
  const emails = Array.from(
    { length: people },
    (_, i) => `p${String(i + 1).padStart(2, "0")}@example.com`,
  );
  const pages: Page[] = [];
  for (const email of emails) pages.push(await person(email));
  const host = pages[0]!;
  const room = JSON.parse(
    await post(host, "/api/books", { title: `Call de ${people}` }),
  ).id as string;
  for (const [i, email] of emails.entries()) {
    if (i === 0) continue;
    await post(host, `/api/books/${room}/members`, { email });
    await post(pages[i]!, `/api/books/${room}/invite`, { yes: true });
  }
  result.room = room;
  const joinStart = Date.now();
  for (const [i, page] of pages.entries()) {
    await page.goto(`${base}/b/${room}`);
    await page.waitForTimeout(800);
    if (await page.getByRole("dialog").count())
      await page.keyboard.press("Escape");
    if (i === 0)
      await page
        .getByRole("button", { name: /Iniciar (call|chamada)/ })
        .first()
        .click();
    else {
      // The call's line in the chat: the top bar's call button pulses, so it is never "stable" for a click.
      // With many pages in one machine the page is slow to settle, so the click goes to the element at once.
      const join = page
        .getByRole("button", { name: "Entrar na call", exact: true })
        .last();
      await join.waitFor({ timeout: 60_000 });
      await join.dispatchEvent("click");
    }
    await page
      .getByRole("button", { name: micButton })
      .first()
      .waitFor({ timeout: 60_000 })
      .catch(async (error) => {
        await page.screenshot({ path: `${output}/join-failed-${i + 1}.png` });
        throw error;
      });
    // Everyone but the first one starts muted; the speakers unmute below.
    // The stage lays out again as each person comes in: the button moves, so the click does not wait for it to stop.
    if (i > 0 || process.env.TEST_ALL_MUTED) await setMic(page, false);
    console.error(
      `joined ${i + 1}/${people}, ${await guard(`person ${i + 1}`)}% memory free`,
    );
    page.on("crash", () => console.error(`page of ${emails[i]} crashed`));
  }
  result.join_s = Math.round((Date.now() - joinStart) / 1000);
  const listener = pages.at(-1)!;
  console.error(
    "connections",
    JSON.stringify(
      await Promise.all(
        pages.map((page) =>
          page.evaluate(() => ({
            url: location.pathname,
            pcs:
              (window as unknown as { pcs?: RTCPeerConnection[] }).pcs?.map(
                (pc) => pc.connectionState,
              ) ?? "no hook",
          })),
        ),
      ),
    ),
  );
  // The listener gets a voice for each person in the call.
  await listener.waitForFunction(
    (n) =>
      (
        (window as unknown as { pcs: RTCPeerConnection[] }).pcs
          .at(-1)
          ?.getReceivers() ?? []
      ).filter((r) => r.track.kind === "audio" && r.track.readyState === "live")
        .length >= n,
    people - 1,
    { timeout: 120_000 },
  );
  await listener.waitForTimeout(3000);

  if (process.env.TEST_PROBE)
    for (const [i, page] of pages.entries())
      console.error(
        "probe",
        i + 1,
        JSON.stringify(
          await page.evaluate(() => ({
            button: [...document.querySelectorAll("button")]
              .map((b) => b.getAttribute("aria-label") ?? "")
              .filter((l) => /microfone/.test(l)),
            senders: (
              window as unknown as { pcs: RTCPeerConnection[] }
            ).pcs.flatMap((pc) =>
              pc
                .getSenders()
                .filter((x) => x.track?.kind === "audio")
                .map((x) => ({
                  enabled: x.track!.enabled,
                  state: x.track!.readyState,
                  label: x.track!.label.slice(0, 30),
                })),
            ),
          })),
        ),
      );
  if (process.env.TEST_PROBE)
    console.error(
      "per-voice dB at the listener",
      JSON.stringify(
        await listener.evaluate(async () => {
          const pc = (window as unknown as { pcs: RTCPeerConnection[] }).pcs.at(
            -1,
          )!;
          const audio = new AudioContext();
          await audio.resume();
          const meters = pc
            .getReceivers()
            .filter((r) => r.track.kind === "audio")
            .map((r) => {
              const node = audio.createAnalyser();
              audio
                .createMediaStreamSource(new MediaStream([r.track]))
                .connect(node);
              return {
                mid: pc.getTransceivers().find((t) => t.receiver === r)?.mid,
                node,
                peak: 0,
              };
            });
          const buf = new Float32Array(2048);
          for (let k = 0; k < 30; k++) {
            await new Promise((d) => setTimeout(d, 100));
            for (const m of meters) {
              m.node.getFloatTimeDomainData(buf);
              let sum = 0;
              for (const x of buf) sum += x * x;
              m.peak = Math.max(m.peak, Math.sqrt(sum / buf.length));
            }
          }
          return meters.map((m) => ({
            mid: m.mid,
            db: Math.round(20 * Math.log10(m.peak || 1e-6)),
          }));
        }),
      ),
    );
  // 1. One speaker (the first person), all the others muted.
  let before = await Promise.all(pages.map(stats));
  result.memory_free_pct = await guard("measure");
  const cpu1 = await cpu();
  result.one_speaker = {
    ...(await record(listener, seconds * 1000, "one-speaker")),
    cpu_pct: Math.round((cpu1 + (await cpu())) / 2),
  };
  let after = await Promise.all(pages.map(stats));
  result.one_speaker_net = {
    listener: rate(before.at(-1)!, after.at(-1)!),
    speaker: rate(before[0]!, after[0]!),
  };

  // 2. The speakers talk at the same time.
  for (let i = 1; i < speakers; i++) await setMic(pages[i]!, true);
  await listener.waitForTimeout(2000);
  before = await Promise.all(pages.map(stats));
  const cpu2 = await cpu();
  result.speakers_together = {
    ...(await record(listener, seconds * 1000, "speakers-together")),
    cpu_pct: Math.round((cpu2 + (await cpu())) / 2),
  };
  after = await Promise.all(pages.map(stats));
  result.speakers_together_net = {
    listener: rate(before.at(-1)!, after.at(-1)!),
    speaker: rate(before[0]!, after[0]!),
  };

  // 3. The first person shares the screen; the others see it.
  await host
    .getByRole("button", { name: /Compartilhar a tela/ })
    .first()
    .dispatchEvent("click");
  await listener.waitForFunction(
    () =>
      (document.querySelector<HTMLVideoElement>(
        "[data-call-stage] video:not([data-call-cam])",
      )?.videoWidth ?? 0) > 0,
    null,
    { timeout: 60_000 },
  );
  before = await Promise.all(pages.map(stats));
  await listener.waitForTimeout(seconds * 1000);
  after = await Promise.all(pages.map(stats));
  const all = pages.map((_, i) => rate(before[i]!, after[i]!));
  result.screen = {
    sharer: all[0],
    listener: all.at(-1),
    total_in_mbps: +(all.reduce((s, r) => s + r.in_kbps, 0) / 1000).toFixed(1),
    worst_lost_pct: Math.max(...all.map((r) => r.lost_pct)),
    worst_concealed_pct: Math.max(...all.map((r) => r.concealed_pct)),
    cpu_pct: Math.round(await cpu()),
  };
  await listener.screenshot({ path: `${output}/screen-at-listener.png` });
  for (const page of pages)
    await page
      .getByRole("button", { name: /Sair da call/ })
      .first()
      .click()
      .catch(() => {});
} finally {
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}
