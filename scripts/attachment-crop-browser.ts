// Real Worker uploads + Book command + chat rendering. Width probes only alter layout.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect as baseExpect } from "@playwright/test";
import * as z from "zod/mini";
import { RoomCommandSchema } from "../shared/commands";
import { createRoomApi } from "../web/app/transport";
const expect = baseExpect.configure({ timeout: 60_000 });
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:8797";
assert(
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base),
  "Use a loopback DEV_EMAIL Worker",
);
const output = process.env.TEST_OUTPUT_DIR ?? "/tmp/vibebook-attachment-crop";
await mkdir(output, { recursive: true });
// The expected chat image geometry: 220-320px wide, at most 260px high, cropped from the top.
const imageRule =
  "display: block; max-width: min(320px, 100%); min-width: 220px; max-height: 260px; object-fit: cover; object-position: top; border-radius: 12px;";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const report: Record<string, unknown> = {
  revisionSuppliedByRunner: process.env.TEST_APP_REVISION ?? null,
  scope:
    "Real typed HTTP PNG uploads, actual Book WebSocket message and chat/viewer. Reference CSS and narrow parent widths are controlled geometry probes, not fabricated application state.",
  gaps: [
    "No production/Safari acceptance. The narrow parent deliberately fits below the fixed 220px reference minimum rather than overflowing.",
    "Fixture attachment posting uses the supported Book command rather than composer input.",
  ],
};
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "en-US",
});
context.setDefaultTimeout(60_000);
const page = await context.newPage();
try {
  await context.addCookies([{ name: "vb_lang", value: "en", url: base }]);
  const created = await context.request.post(base + "/api/books", {
    headers: { origin: base },
    data: { title: "Attachment crop geometry" },
  });
  assert(created.ok());
  const roomId = z.object({ id: z.string() }).parse(await created.json()).id;
  report.room = roomId;
  const api = createRoomApi(roomId, async (input, init) => {
    const request =
      input instanceof Request
        ? new Request(input, init)
        : new Request(new URL(String(input), base), init);
    const response = await context.request.fetch(request.url, {
      method: request.method,
      headers: { ...Object.fromEntries(request.headers), origin: base },
      data:
        request.method === "GET"
          ? undefined
          : Buffer.from(await request.arrayBuffer()),
    });
    return new Response(await response.text(), {
      status: response.status(),
      headers: response.headers(),
    });
  });
  // Canvas creates deterministic PNG bytes only; every displayed attachment then comes from actual R2/Book data.
  const sources = [
    { name: "normal.png", width: 640, height: 480 },
    { name: "square.png", width: 400, height: 400 },
    { name: "wide.png", width: 1200, height: 300 },
    { name: "tall.png", width: 600, height: 9000 },
  ];
  const ids: string[] = [];
  for (const source of sources) {
    const encoded = await page.evaluate(({ width, height }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error("Canvas unavailable");
      ctx.fillStyle = "rgb(220,220,220)";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "rgb(24,24,24)";
      ctx.fillRect(0, 0, width, Math.min(200, height));
      return canvas.toDataURL("image/png").split(",")[1]!;
    }, source);
    const bytes = new Uint8Array(Buffer.from(encoded, "base64"));
    const uploaded = await api.uploadFile({
      name: source.name,
      type: "image/png",
      body: bytes.buffer,
    });
    ids.push(uploaded.id);
  }
  await page.goto(`${base}/b/${roomId}`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  report.loadedVersion = await page
    .locator('meta[name="vb-v"]')
    .getAttribute("content");
  // A JSON-RPC request (shared/jsonRpc.ts), sent by hand from the page.
  const { t: method, ...params } = RoomCommandSchema.parse({
    t: "msg",
    thread: "main",
    text: "Real attachment crop fixtures",
    files: ids,
  });
  const command = {
    jsonrpc: "2.0",
    id: "attachment-geometry",
    method,
    params,
  };
  const result: unknown = await page.evaluate(
    ({ roomId, command }) =>
      new Promise((resolve, reject) => {
        const ws = new WebSocket(
          `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/${roomId}`,
        );
        const timer = setTimeout(() => {
          ws.close();
          reject(Error("Book command timeout"));
        }, 30_000);
        let sent = false;
        ws.onmessage = (event) => {
          if (typeof event.data !== "string") return;
          const value: unknown = JSON.parse(event.data);
          if (!value || typeof value !== "object") return;
          if ("method" in value && value.method === "state" && !sent) {
            sent = true;
            ws.send(JSON.stringify(command));
          }
          if ("id" in value && value.id === command.id) {
            clearTimeout(timer);
            ws.close();
            resolve(value);
          }
        };
        ws.onerror = () => {
          clearTimeout(timer);
          ws.close();
          reject(Error("Book socket failed"));
        };
      }),
    { roomId, command },
  );
  assert(
    typeof result === "object" && result !== null && "result" in result,
    "Backend must accept the real attachment message",
  );
  const metrics: unknown[] = [];
  for (const [index, source] of sources.entries()) {
    const image = page.locator(
      `[data-message-image] img[src$="/${ids[index]}"]`,
    );
    await expect(image).toBeVisible();
    await image.evaluate(async (element: HTMLImageElement) => {
      await element.decode();
    });
    const actual = await image.evaluate((element: HTMLImageElement) => {
      const box = element.getBoundingClientRect(),
        css = getComputedStyle(element);
      return {
        width: box.width,
        height: box.height,
        naturalWidth: element.naturalWidth,
        naturalHeight: element.naturalHeight,
        fit: css.objectFit,
        position: css.objectPosition,
      };
    });
    assert.equal(actual.naturalWidth, source.width);
    assert.equal(actual.naturalHeight, source.height);
    assert(actual.width <= 321 && actual.height <= 261 && actual.width >= 219);
    assert.equal(actual.fit, "cover");
    assert.equal(actual.position, "50% 0%");
    const reference: { width: number; height: number } = await page.evaluate(
      async ({ imageRule, src }) => {
        const parent = document.createElement("div"),
          style = document.createElement("style"),
          img = document.createElement("img");
        parent.style.cssText = "position:fixed;left:-10000px;top:0;width:360px";
        parent.dataset.geometryReference = "";
        style.textContent = `[data-geometry-reference] img {${imageRule}}`;
        img.src = src;
        document.head.append(style);
        parent.append(img);
        document.body.append(parent);
        try {
          await img.decode();
          const box = img.getBoundingClientRect();
          return { width: box.width, height: box.height };
        } finally {
          parent.remove();
          style.remove();
        }
      },
      { imageRule, src: `${base}/api/books/${roomId}/files/${ids[index]}` },
    );
    assert(
      Math.abs(actual.width - reference.width) <= 2 &&
        Math.abs(actual.height - reference.height) <= 2,
      `${source.name}: geometry must match the reference at ordinary width`,
    );
    metrics.push({ name: source.name, actual, reference });
  }
  const tall = page.locator(`[data-message-image] img[src$="/${ids[3]}"]`);
  const crop = await tall.screenshot();
  await writeFile(`${output}/tall-crop.png`, crop);
  const topPixel = await page.evaluate(async (encoded) => {
    const img = new Image();
    img.src = `data:image/png;base64,${encoded}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Canvas unavailable");
    ctx.drawImage(img, 0, 0);
    return [...ctx.getImageData(Math.floor(img.width / 2), 15, 1, 1).data];
  }, crop.toString("base64"));
  assert(
    topPixel[0]! < 60,
    "Actual screenshot must show the dark source top, not its light center",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await tall.evaluate((element: HTMLImageElement) => {
    const parent = element.closest<HTMLElement>("[data-message-attachments]");
    if (!parent) throw Error("Missing attachments");
    parent.style.width = "180px";
  });
  const narrow = await tall.evaluate((element: HTMLImageElement) => ({
    image: element.getBoundingClientRect().width,
    parent: element
      .closest("[data-message-attachments]")!
      .getBoundingClientRect().width,
  }));
  assert(
    narrow.image <= narrow.parent + 1 && narrow.image >= 178,
    "Narrow parents must fit the readable crop without overflow",
  );
  await tall.click();
  await expect(
    page.locator("[data-file-viewer][data-file-id]"),
  ).toHaveAttribute("data-file-id", ids[3]!);
  const full = page.locator("[data-file-viewer] img");
  await expect(full).toBeVisible();
  assert.equal(
    await full.evaluate(
      (element: HTMLImageElement) => getComputedStyle(element).objectFit,
    ),
    "contain",
  );
  assert.equal(
    await full.evaluate((element: HTMLImageElement) => element.naturalHeight),
    9000,
  );
  report.metrics = metrics;
  report.narrow = narrow;
  report.topPixel = topPixel;
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = error instanceof Error ? error.message : String(error);
  await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
