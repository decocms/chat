// Screens of a change, taken on local development, for its pull request (Gui #4723: no UI change ships without them).
// Needs `bun run dev` with DEV_EMAIL set (docs/workflow.md, "Screens"). It makes a new test room with test data,
// takes the room and the home at 1440 and 390 px, and a hovered message. With --publish it pushes the files to the
// orphan branch `pr-screens` (no workflow runs there) and prints the Markdown to paste in the pull request.
//
//   bun scripts/screens.ts [--publish] [--hover] [--react] [--link] [--dm] [--resume] [--marks] [--forward] [--name <folder>]
import { chromium, type Page } from "playwright";
import { mkdir, cp, mkdtemp, rm, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

const base = process.env.SCREENS_ORIGIN ?? "http://127.0.0.1:8797";
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const branch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();
const name = (value("name") ?? branch).replace(/[^\w.-]+/g, "-");
const out = join(".screens", name);
await mkdir(out, { recursive: true });

const me = await fetch(`${base}/api/me`);
if (!me.ok)
  throw new Error(
    `${base}/api/me answered ${me.status}: start \`bun run dev\` with DEV_EMAIL in .dev.vars`,
  );
const made = await fetch(`${base}/api/books`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ title: "Sala de teste" }),
});
if (!made.ok) throw new Error(`create room: ${made.status}`);
const { id: room } = (await made.json()) as { id: string };

const long = Array.from(
  { length: 12 },
  (_, i) => `Linha ${i + 1} de uma mensagem longa de teste.`,
).join("\n");
async function send(page: Page, text: string) {
  const editor = page.locator('[contenteditable="true"], textarea').first();
  await editor.click();
  await editor.fill(text);
  await page.keyboard.press("Enter");
  // Sent when it is a message in the list, not only text in the composer.
  await page
    .locator("[data-chat-message]", { hasText: text.split("\n").at(-1)! })
    .first()
    .waitFor();
}

const browser = await chromium.launch();
const shots: string[] = [];
const videos: string[] = [];
try {
  const desk = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await desk.goto(`${base}/b/${room}`, { waitUntil: "networkidle" });
  await send(desk, "Primeira mensagem curta de teste.");
  await send(desk, long);
  await send(desk, "Última mensagem curta de teste.");
  const target = desk
    .locator("[data-chat-message]", { hasText: "Linha 12 de uma" })
    .first();
  await desk.mouse.move(0, 0);
  await desk.waitForTimeout(400);
  await desk.screenshot({ path: join(out, "room-1440.png") });
  shots.push("room-1440.png");
  if (flag("hover")) {
    await target.hover();
    await desk.waitForTimeout(400);
    await desk.screenshot({ path: join(out, "hover-1440.png") });
    shots.push("hover-1440.png");
  }
  if (flag("react")) {
    // The first reaction offered on hover, clicked: it should turn into a chip under the message.
    await target.hover();
    await target.locator("[data-offer-react]").first().click();
    await target
      .locator('[data-message-reactions] [aria-pressed="true"]')
      .first()
      .waitFor();
    await target.hover();
    await desk.waitForTimeout(400);
    await desk.screenshot({ path: join(out, "react-1440.png") });
    shots.push("react-1440.png");
    // 🙂 opens every emoji in a popover next to the message's reactions.
    await target.locator("[data-add-reaction]").click();
    await desk.locator("[data-emoji-popover]").waitFor();
    await desk.waitForTimeout(300);
    await desk.screenshot({ path: join(out, "picker-1440.png") });
    shots.push("picker-1440.png");
    await desk.keyboard.press("Escape");
  }
  if (flag("marks")) {
    // Markdown shortcuts in the composer (Pedro): the keys write the marks, and a person's message renders them.
    const field = desk.locator("textarea").first();
    const shortcut = async (
      text: string,
      select: [number, number],
      keys: string,
      shown: string,
    ) => {
      await field.click();
      await field.fill(text);
      await field.evaluate(
        (node: HTMLTextAreaElement, [from, to]) =>
          node.setSelectionRange(from, to),
        select,
      );
      await desk.keyboard.press(keys);
      await desk.keyboard.press("Enter");
      await desk.locator(`[data-chat-message] ${shown}`).last().waitFor();
    };
    await shortcut("Status do projeto", [0, 6], "ControlOrMeta+b", "strong");
    await shortcut("Prazo de entrega", [9, 16], "ControlOrMeta+u", "u");
    await shortcut(
      "Veja www.decocms.com",
      [5, 20],
      "ControlOrMeta+Shift+k",
      "a",
    );
    await shortcut("bun run check", [0, 13], "ControlOrMeta+Shift+e", "pre");
    await shortcut(
      "Uma citação de outra pessoa",
      [0, 27],
      "ControlOrMeta+Shift+Digit9",
      "blockquote",
    );
    await field.click();
    await field.fill(
      "Também _itálico_, ~~riscado~~ e `código`. Fica como texto: snake_case_nome, 2*3*4.",
    );
    await desk.keyboard.press("Enter");
    await desk.locator("[data-chat-message] del").last().waitFor();
    await desk.mouse.move(0, 0);
    await desk.waitForTimeout(400);
    await desk.screenshot({ path: join(out, "marks-1440.png") });
    shots.push("marks-1440.png");
  }
  if (flag("link")) {
    // A copied link to an old message (Gimenes #4843): more than one window of messages after it, then the link opens
    // in a new tab. The view must show that message, not the bottom of the room.
    const id = await desk
      .locator("[data-chat-message]", { hasText: "Primeira mensagem curta" })
      .first()
      .evaluate((node) => node.closest("[id^=m]")?.id ?? node.id);
    for (let i = 1; i <= 80; i++) await send(desk, `Mensagem de teste ${i}.`);
    const tab = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await tab.goto(`${base}/b/${room}#${id}`, { waitUntil: "networkidle" });
    await tab.waitForTimeout(1500);
    await tab.screenshot({ path: join(out, "link-1440.png") });
    shots.push("link-1440.png");
  }
  if (flag("dm")) {
    // A colleague (Gimenes #5006): an account on the test email's domain, with no room shared, shows in "Nova
    // mensagem" with "pelo seu e-mail". Local D1 only.
    const domain =
      ((await me.clone().json()) as { email: string }).email.split("@")[1] ??
      "";
    await $`bunx wrangler d1 execute chat --local --command ${`INSERT OR IGNORE INTO users (email, name) VALUES ('colega@${domain}', 'Colega de Teste')`}`.quiet();
    const home = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await home.goto(`${base}/`, { waitUntil: "networkidle" });
    await home.locator("[data-home-new]").first().click();
    await home.locator(`[data-contact="colega@${domain}"]`).waitFor();
    await home.waitForTimeout(300);
    await home.screenshot({ path: join(out, "dm-390.png") });
    shots.push("dm-390.png");
  }
  if (flag("resume")) {
    // Coming back to a room, and your last threads (Viktor), at 1440 and 390 px, with a video of each. Six threads
    // (A to F) from six messages, E pinned. Thread A holds a link to "Outra sala de teste" (a phone leaves a thread
    // only to the room's main or by a link), and that room holds a link to thread B and one to that message in A.
    // Then, in a new tab: open A, leave, come back (A opens again); open B and C (C, B, A sit under the pinned E); open
    // A again (no row moves); open D (it pushes A out of the three); follow the two links (they go where they say,
    // not to the thread you left); click the room you are in (main). Each step fails the run when the app does
    // something else.
    const other = await fetch(`${base}/api/books`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({ title: "Outra sala de teste" }),
    });
    if (!other.ok) throw new Error(`create room: ${other.status}`);
    const { id: second } = (await other.json()) as { id: string };
    /** A message whose link becomes a chip: wait for the words before the ":". */
    const post = async (text: string) => {
      const editor = desk.locator('[contenteditable="true"], textarea').first();
      await editor.click();
      await editor.fill(text);
      await desk.keyboard.press("Enter");
      await desk
        .locator("[data-chat-message]", { hasText: text.split(":")[0]! })
        .first()
        .waitFor();
    };
    const away = `Link da outra sala: ${base}/b/${second}`;
    const subjects = ["A", "B", "C", "D", "E", "F"].map(
      (s) => `Assunto ${s} de teste`,
    );
    for (const subject of subjects) await send(desk, `${subject}.`);
    const threads: string[] = [];
    let quoted = "";
    for (const subject of subjects) {
      await desk.goto(`${base}/b/${room}`, { waitUntil: "networkidle" });
      const message = desk
        .locator("[data-chat-message]", { hasText: subject })
        .first();
      await message.hover();
      await message.locator("[data-start-thread]").click();
      await desk.waitForURL(/[?&]t=/);
      threads.push(new URL(desk.url()).searchParams.get("t")!);
      if (threads.length > 1) continue;
      await post(away);
      quoted = await desk
        .locator("[data-chat-message]", { hasText: "Link da outra sala" })
        .first()
        .evaluate((node) => node.closest("[id^=m]")?.id ?? node.id);
    }
    const [a, b, c, d, e, f] = threads as [
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    await desk.locator(`[data-epic-thread="${e}"]`).click();
    await desk.waitForURL(new RegExp(`[?&]t=${e}`));
    await desk.locator("[data-epic-status]").click();
    await desk.locator(`[data-epic-pin="${e}"]`).click();
    await desk.locator(`[data-epic="${e}"] [data-epic-pinned]`).waitFor();
    await desk.goto(`${base}/b/${second}`, { waitUntil: "networkidle" });
    const links = {
      thread: `Link da thread B: ${base}/b/${room}?t=${b}`,
      message: `Link da mensagem: ${base}/b/${room}?t=${a}#${quoted}`,
    };
    for (const text of Object.values(links)) await post(text);

    for (const width of [1440, 390]) {
      const phone = width === 390;
      const context = await browser.newContext({
        viewport: phone
          ? { width: 390, height: 844 }
          : { width: 1440, height: 900 },
        ...(phone ? { isMobile: true, hasTouch: true } : {}),
        recordVideo: {
          dir: join(out, "video"),
          size: phone
            ? { width: 390, height: 844 }
            : { width: 1440, height: 900 },
        },
      });
      const page = await context.newPage();
      const shot = async (step: string) => {
        await page.mouse.move(0, 0);
        await page.waitForTimeout(500);
        const file = `resume-${step}-${width}.png`;
        await page.screenshot({ path: join(out, file) });
        shots.push(file);
      };
      /** Waits until the app shows that room and thread ("main" when the address has no thread). */
      const at = (id: string, thread = "main", hash?: string) =>
        page.waitForURL(
          (url) =>
            url.pathname === `/b/${id}` &&
            (url.searchParams.get("t") ?? "main") === thread &&
            (hash === undefined || url.hash === hash),
        );
      const drawer = async () => {
        const rows = page.locator("[data-room-sidebar] [data-epic-thread]");
        if (!phone || (await rows.first().isVisible())) return;
        await page.locator("[data-phone-thread]").click();
        await page
          .locator("[data-room-sidebar] [data-epic-thread]")
          .first()
          .waitFor();
        await page.waitForTimeout(400);
      };
      const openThread = async (id: string) => {
        await drawer();
        await page.locator(`[data-epic-thread="${id}"]`).click();
        await at(room, id);
        await page.waitForTimeout(500);
      };
      const order = () =>
        page
          .locator("[data-epic-thread]")
          .evaluateAll((rows) =>
            rows.map((row) => row.getAttribute("data-epic-thread")),
          );
      const expectOrder = async (want: string[], what: string) => {
        const got = (await order()).slice(0, want.length);
        if (got.join() !== want.join())
          throw new Error(`${width} px, ${what}: sidebar ${got.join()}`);
      };
      /** Phone: ← until the home (from a thread, ← goes to the room's main first). */
      const home = async () => {
        for (let i = 0; i < 3 && new URL(page.url()).pathname !== "/"; i++) {
          await page.locator("[data-phone-back]").click();
          await page.waitForTimeout(500);
        }
        await page.locator("[data-home-chats]").waitFor();
      };
      /** Desktop: the room's tile in the rail. Phone: back to the home, then the room's row. */
      const goRoom = async (id: string) => {
        if (phone) {
          await home();
          await page
            .locator(`[data-home-chats] a[href="/b/${id}"]`)
            .first()
            .click();
        } else
          await page
            .locator(`[data-app-navigation] [data-room-id="${id}"] a`)
            .click();
      };
      const follow = async (text: string) => {
        await page
          .locator("[data-chat-message]", { hasText: text.split(":")[0]! })
          .first()
          .locator("a")
          .first()
          .click();
      };

      await page.goto(`${base}/b/${room}`, { waitUntil: "networkidle" });
      await openThread(a);
      await shot("1-thread");
      if (phone) {
        await follow(away);
        await at(second);
        await page.waitForTimeout(500);
        await home();
      } else {
        await goRoom(second);
        await at(second);
      }
      await shot("2-away");
      await goRoom(room);
      await at(room, a);
      await shot("3-back");
      await openThread(b);
      await openThread(c);
      await drawer();
      await expectOrder([e, c, b, a, f, d], "recent threads");
      await shot("4-recent");
      await openThread(a);
      await drawer();
      await expectOrder([e, c, b, a, f, d], "a recent thread opened again");
      await shot("5-no-reorder");
      await openThread(d);
      await drawer();
      await expectOrder([e, d, c, b, f, a], "a fourth thread");
      await shot("6-fourth");
      if (phone) await page.keyboard.press("Escape");
      await goRoom(second);
      await at(second);
      await follow(links.thread);
      await at(room, b);
      await shot("7-thread-link");
      await goRoom(second);
      await at(second);
      await follow(links.message);
      await at(room, a, `#${quoted}`);
      await page.waitForTimeout(800);
      const box = await page.locator(`#${quoted}`).boundingBox();
      if (!box || box.y < 0 || box.y > (phone ? 844 : 900))
        throw new Error(`${width} px: the linked message is not on screen`);
      await shot("7-message-link");
      await openThread(c);
      if (phone) {
        // A phone has no rail in a room: the room's row on top of the drawer opens main.
        await drawer();
        await page.locator("[data-room-sidebar] [data-room-title]").click();
      } else
        await page
          .locator(`[data-app-navigation] [data-room-id="${room}"] a`)
          .click();
      await at(room);
      await shot("8-current-main");
      const video = page.video();
      await context.close();
      if (video) {
        const file = `resume-${width}.webm`;
        await rename(await video.path(), join(out, file));
        videos.push(file);
      }
    }
  }
  if (flag("forward")) await forwardScreens(browser, shots);
  for (const [path, file] of [
    [`/b/${room}`, "room-390.png"],
    ["/", "home-390.png"],
  ] as const) {
    const phone = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await phone.goto(`${base}${path}`, { waitUntil: "networkidle" });
    await phone.waitForTimeout(400);
    await phone.screenshot({ path: join(out, file) });
    shots.push(file);
  }
} finally {
  await browser.close();
}
console.log(`Screens in ${out}: ${[...shots, ...videos].join(", ")}`);

if (flag("publish")) {
  // One folder per branch on the orphan branch `pr-screens`; the repository is public, so test data only.
  const dir = await mkdtemp(join(tmpdir(), "pr-screens-"));
  try {
    const remote = (await $`git config --get remote.origin.url`.text()).trim();
    const exists = (
      await $`git ls-remote --heads origin pr-screens`.text()
    ).trim();
    if (exists)
      await $`git clone --quiet --depth 1 --branch pr-screens ${remote} ${dir}`;
    else
      await $`git init --quiet -b pr-screens ${dir} && git -C ${dir} remote add origin ${remote}`;
    await cp(out, join(dir, name), { recursive: true });
    await $`git -C ${dir} add ${name}`;
    await $`git -C ${dir} commit --quiet -m ${`screens: ${name}`}`;
    await $`git -C ${dir} push --quiet origin pr-screens`;
    const repo = remote.replace(/^.*github\.com[:/]/, "").replace(/\.git$/, "");
    const sha = (await $`git -C ${dir} rev-parse HEAD`.text()).trim();
    console.log("\n## Screens\n");
    for (const file of shots)
      console.log(
        `![${file}](https://raw.githubusercontent.com/${repo}/${sha}/${name}/${file})`,
      );
    // A video does not show inline in a pull request: a link to the file.
    for (const file of videos)
      console.log(
        `[${file}](https://raw.githubusercontent.com/${repo}/${sha}/${name}/${file})`,
      );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * "Encaminhar" (forward, --forward): every state at 1440 and 390 px, and a video of the desktop flow. Two test people
 * talk in a new room (Bruno joins with the dev_as cookie), Ana's message has an image, and the room has a thread.
 * The forward goes to a second new room, "Sala destino", whose composer gets the package; nothing is sent.
 */
async function forwardScreens(
  browser: import("playwright").Browser,
  shots: string[],
) {
  const json = (email?: string) => ({
    "content-type": "application/json",
    origin: base,
    ...(email ? { cookie: `dev_as=${encodeURIComponent(email)}` } : {}),
  });
  const post = async (path: string, body: unknown, email?: string) => {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: json(email),
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return (await response.json()) as { id?: string };
  };
  const bruno = "bruno@example.test";
  await post("/api/me", { name: "Ana Souza" });
  const { id: source } = await post("/api/books", {
    title: "Evento de fim de ano",
  });
  const { id: target } = await post("/api/books", { title: "Sala destino" });
  await post(`/api/books/${source}/members`, { email: bruno });
  await post("/api/me", { name: "Bruno Lima" }, bruno);
  await post(`/api/books/${source}/invite`, { yes: true }, bruno);
  const say = (text: string, email?: string) =>
    post(`/api/books/${source}/post`, { text, thread: "main" }, email);
  await say(
    "Pessoal, fechei o orçamento do evento: R$ 12 mil no total.",
    bruno,
  );
  await say("Ótimo! Dá pra dividir em duas parcelas?");
  await say("Dá sim. A primeira agora e a segunda depois do evento.", bruno);
  const row = (page: Page, text: string) =>
    page.locator("[data-chat-message]", { hasText: text }).first();

  // Desktop, with a video of the whole flow.
  const video = join(out, "video");
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    // Desktop in Portuguese, the phone in English: both languages of each text.
    locale: "pt-BR",
    recordVideo: { dir: video, size: { width: 1440, height: 900 } },
  });
  const desk = await context.newPage();
  await desk.goto(`${base}/b/${source}`, { waitUntil: "networkidle" });
  // Ana's message with an image (drawn here: test data only).
  const image = await desk.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 270;
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#e8f5d0";
    g.fillRect(0, 0, 480, 270);
    g.fillStyle = "#1f2a10";
    g.font = "bold 32px sans-serif";
    g.fillText("Plano do evento", 32, 70);
    g.font = "24px sans-serif";
    g.fillText("1ª parcela: dezembro", 32, 140);
    g.fillText("2ª parcela: janeiro", 32, 190);
    return canvas.toDataURL("image/png").split(",")[1]!;
  });
  await desk.locator('[data-composer] input[type="file"]').setInputFiles({
    name: "plano-do-evento.png",
    mimeType: "image/png",
    buffer: Buffer.from(image, "base64"),
  });
  // Sent only once the upload ends (the composer refuses a send with a file on its way).
  await desk.waitForTimeout(1500);
  await send(desk, "Segue o plano com as datas.");
  await say("Perfeito, vou mandar pro financeiro hoje.", bruno);
  await say("Combinado. Obrigada, Bruno!");
  await row(desk, "Combinado. Obrigada").waitFor();
  // A thread in the room, so the picker lists one under "Nesta sala".
  await row(desk, "Dá sim. A primeira").hover();
  await row(desk, "Dá sim. A primeira").locator("[data-start-thread]").click();
  await desk.waitForURL(/[?&]t=/);
  await desk.goto(`${base}/b/${source}`, { waitUntil: "networkidle" });
  await row(desk, "Combinado. Obrigada").waitFor();
  await desk.mouse.move(0, 0);
  const shot = async (page: Page, file: string) => {
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(out, file) });
    shots.push(file);
  };
  await shot(desk, "forward-room-1440.png");
  await row(desk, "fechei o orçamento").hover();
  await shot(desk, "forward-hover-1440.png");
  await row(desk, "fechei o orçamento").locator("[data-forward]").click();
  await desk.locator("[data-forward-bar] [role=toolbar]").waitFor();
  await desk.mouse.move(0, 0);
  await shot(desk, "forward-one-1440.png");
  await row(desk, "Dá sim. A primeira").click();
  await row(desk, "Segue o plano").click();
  await desk.mouse.move(0, 0);
  await shot(desk, "forward-several-1440.png");
  await row(desk, "Combinado. Obrigada").click({ modifiers: ["Shift"] });
  await desk.mouse.move(0, 0);
  await shot(desk, "forward-range-1440.png");
  await desk.locator("[data-forward-open]").click();
  await desk.locator("[data-forward-picker]").waitFor();
  await shot(desk, "forward-picker-1440.png");
  await desk.keyboard.type("destino");
  await shot(desk, "forward-picker-search-1440.png");
  await desk.locator(`[data-forward-target="${target}:main"]`).click();
  await desk.waitForURL(new RegExp(`/b/${target}`));
  const filled = async (page: Page) => {
    await page.waitForFunction(() =>
      [...document.querySelectorAll("[data-composer] textarea")].some((box) =>
        /^(Encaminhado de|Forwarded from) /.test(
          (box as HTMLTextAreaElement).value,
        ),
      ),
    );
    // The image is uploaded again into this room: its chip settles when the upload ends.
    await page.waitForTimeout(2000);
  };

  await filled(desk);
  await shot(desk, "forward-composer-1440.png");
  await context.close();
  const recorded = await desk.video()?.path();
  if (recorded) {
    await cp(recorded, join(out, "forward-1440.webm"));
    await rm(video, { recursive: true, force: true });
    videos.push("forward-1440.webm");
  }

  // Phone: hold a message for its sheet, then taps (Shift+tap for the range).
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await phone.goto(`${base}/b/${source}`, { waitUntil: "networkidle" });
  await row(phone, "Combinado. Obrigada").waitFor();
  await shot(phone, "forward-room-390.png");
  const held = row(phone, "fechei o orçamento");
  const box = (await held.boundingBox())!;
  const cdp = await phone.context().newCDPSession(phone);
  const point = [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }];
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: point,
  });
  await phone.waitForTimeout(700);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await phone.locator("[data-sheet-forward]").waitFor();
  await shot(phone, "forward-sheet-390.png");
  await phone.locator("[data-sheet-forward]").tap();
  await phone.locator("[data-forward-bar] [role=toolbar]").waitFor();
  await shot(phone, "forward-one-390.png");
  await row(phone, "Dá sim. A primeira").tap();
  await row(phone, "Segue o plano").tap();
  await shot(phone, "forward-several-390.png");
  await row(phone, "Combinado. Obrigada").tap({ modifiers: ["Shift"] });
  await shot(phone, "forward-range-390.png");
  await phone.locator("[data-forward-open]").tap();
  await phone.locator("[data-forward-picker]").waitFor();
  await shot(phone, "forward-picker-390.png");
  await phone.locator(`[data-forward-target="${target}:main"]`).tap();
  await phone.waitForURL(new RegExp(`/b/${target}`));
  await filled(phone);
  await shot(phone, "forward-composer-390.png");
}
