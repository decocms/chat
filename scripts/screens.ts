// Screens of a change, taken on local development, for its pull request (Gui #4723: no UI change ships without them).
// Needs `bun run dev` with DEV_EMAIL set (docs/workflow.md, "Screens"). It makes a new test room with test data,
// takes the room and the home at 1440 and 390 px, and a hovered message. With --publish it pushes the files to the
// orphan branch `pr-screens` (no workflow runs there) and prints the Markdown to paste in the pull request.
//
//   bun scripts/screens.ts [--publish] [--hover] [--react] [--link] [--dm] [--threads] [--resume] [--marks] [--studio] [--settings] [--center] [--forward] [--audio] [--search] [--threadmenu] [--topbar] [--name <folder>]
import { chromium, type Locator, type Page } from "playwright";
import { mkdir, cp, mkdtemp, rm, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { galleryPath, serveBuiltGallery } from "./browser-static-gallery";

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

/** A message action from its hover bar, or from its ⋯ menu when the bar does not keep it (Valls). */
async function act(message: Locator, attr: string) {
  const inBar = message.locator(`[data-message-toolbar] [${attr}]`).first();
  if (await inBar.count()) return inBar.click();
  await message.locator("[data-more-actions]").first().click();
  await message.page().locator(`[data-message-menu] [${attr}]`).first().click();
}
/** Room commands over the room's own socket (JSON-RPC, shared/jsonRpc.ts), from the page: it has the session. */
async function commands(page: Page, room: string, list: object[]) {
  await page.evaluate(
    async ({ room, list }) => {
      const ws = new WebSocket(
        `${location.origin.replace(/^http/, "ws")}/ws/${room}`,
      );
      await new Promise((ok, fail) => {
        ws.onopen = ok;
        ws.onerror = fail;
      });
      for (const [id, command] of list.entries()) {
        const { t, ...params } = command as { t: string };
        const answer = new Promise<void>((ok, fail) => {
          const listen = (event: MessageEvent) => {
            const frame = JSON.parse(String(event.data)) as {
              id?: number;
              error?: { message: string };
            };
            if (frame.id !== id) return;
            ws.removeEventListener("message", listen);
            if (frame.error) fail(new Error(`${t}: ${frame.error.message}`));
            else ok();
          };
          ws.addEventListener("message", listen);
        });
        ws.send(JSON.stringify({ jsonrpc: "2.0", id, method: t, params }));
        await answer;
      }
      ws.close();
    },
    { room, list },
  );
}
/** A room with test threads: `mine` are the test email's, `theirs` a colleague's (a member of the room); `done` are marked done. */
async function threadRoom(
  title: string,
  threads: {
    id: string;
    title: string;
    theirs?: boolean;
    done?: boolean;
    status?: string;
    pinned?: boolean;
  }[],
  page: Page,
  colleague: string,
) {
  const made = await fetch(`${base}/api/books`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ title }),
  });
  if (!made.ok) throw new Error(`create room: ${made.status}`);
  const { id } = (await made.json()) as { id: string };
  await $`bunx wrangler d1 execute chat --local --command ${`INSERT OR IGNORE INTO members (book_id, email) VALUES ('${id}', '${colleague}')`}`.quiet();
  await page.goto(`${base}/b/${id}`, { waitUntil: "networkidle" });
  await commands(
    page,
    id,
    threads.flatMap((thread) => [
      { t: "epic", title: thread.title, id: thread.id },
      ...(thread.theirs
        ? [{ t: "epic.owner", id: thread.id, owner: colleague }]
        : []),
      ...(thread.status
        ? [{ t: "epic.status", id: thread.id, status: thread.status }]
        : []),
      ...(thread.pinned
        ? [{ t: "epic.pin", id: thread.id, pinned: true }]
        : []),
      ...(thread.done ? [{ t: "epic.done", id: thread.id, done: true }] : []),
    ]),
  );
  return id;
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
  if (flag("image")) {
    // The full-screen image viewer (Gimenes #5961, option B): fit, a click zooms at the click, ← goes to the
    // previous image of the thread. Two drawn images (test data only), with small text that needs the zoom.
    for (const [name, title] of [
      ["primeira.png", "Primeira imagem"],
      ["topbar.png", "Topbar com detalhe pequeno"],
    ]) {
      const data = await desk.evaluate((title) => {
        const canvas = document.createElement("canvas");
        canvas.width = 1600;
        canvas.height = 1000;
        const g = canvas.getContext("2d")!;
        g.fillStyle = "#dbe7ff";
        g.fillRect(0, 0, 1600, 1000);
        g.fillStyle = "#ffffff";
        g.fillRect(60, 60, 1480, 110);
        g.fillRect(60, 220, 700, 700);
        g.fillStyle = "#1c2a4a";
        g.font = "bold 56px sans-serif";
        g.fillText(title, 100, 135);
        g.font = "14px sans-serif";
        g.fillText("v2.4.1 · detalhe que só se lê com zoom", 1180, 130);
        return canvas.toDataURL("image/png").split(",")[1]!;
      }, title);
      await desk.locator('[data-composer] input[type="file"]').setInputFiles({
        name,
        mimeType: "image/png",
        buffer: Buffer.from(data, "base64"),
      });
      await desk.waitForTimeout(1500);
      await send(desk, `Imagem: ${title}`);
    }
    await desk
      .locator('[data-chat-message] img[alt="topbar.png"]')
      .last()
      .click();
    const viewer = desk.locator("[data-image-preview] [data-image-stage] img");
    await viewer.waitFor();
    await desk.mouse.move(0, 0);
    await desk.waitForTimeout(600);
    await desk.screenshot({ path: join(out, "image-fit-1440.png") });
    shots.push("image-fit-1440.png");
    const stage = await desk.locator("[data-image-stage]").boundingBox();
    if (!stage) throw new Error("image stage has no box");
    await desk.mouse.click(
      stage.x + stage.width * 0.8,
      stage.y + stage.height * 0.2,
    );
    await desk.waitForTimeout(600);
    await desk.screenshot({ path: join(out, "image-zoom-1440.png") });
    shots.push("image-zoom-1440.png");
    await desk.keyboard.press("ArrowLeft");
    await desk
      .locator('[data-image-preview] img[alt="primeira.png"]')
      .waitFor();
    await desk.waitForTimeout(600);
    await desk.screenshot({ path: join(out, "image-previous-1440.png") });
    shots.push("image-previous-1440.png");
    await desk.keyboard.press("Escape");
    await desk.locator("[data-image-preview]").waitFor({ state: "detached" });
    await desk.setViewportSize({ width: 390, height: 844 });
    await desk
      .locator('[data-chat-message] img[alt="topbar.png"]')
      .last()
      .click();
    await desk.locator("[data-image-preview] [data-image-stage] img").waitFor();
    await desk.waitForTimeout(600);
    await desk.screenshot({ path: join(out, "image-fit-390.png") });
    shots.push("image-fit-390.png");
    await desk.keyboard.press("Escape");
    await desk.locator("[data-image-preview]").waitFor({ state: "detached" });
    await desk.setViewportSize({ width: 1440, height: 900 });
  }
  if (flag("thread")) {
    // A message with a thread card and a reaction (Gimenes #5477): the reaction row keeps a gap under the card, and
    // the 🙂 button shows only on hover, also when there are chips.
    const source = desk
      .locator("[data-chat-message]", { hasText: "Última mensagem curta" })
      .first();
    await source.hover();
    await act(source, "data-start-thread");
    // A new thread opens itself (?t=); its card shows in the main thread.
    await desk.waitForURL(/[?&]t=/);
    await desk.goto(`${base}/b/${room}`, { waitUntil: "networkidle" });
    await desk.locator("[data-thread-card]").first().waitFor();
    const carded = desk
      .locator("[data-chat-message]", {
        has: desk.locator("[data-thread-card]"),
      })
      .first();
    await carded.hover();
    await carded
      .locator("[data-message-toolbar] [data-quick-react]")
      .first()
      .click();
    await carded
      .locator('[data-message-reactions] [aria-pressed="true"]')
      .first()
      .waitFor();
    await desk.mouse.move(0, 0);
    await desk.waitForTimeout(400);
    await desk.screenshot({ path: join(out, "thread-react-1440.png") });
    shots.push("thread-react-1440.png");
    await carded.hover();
    await desk.waitForTimeout(400);
    await desk.screenshot({ path: join(out, "thread-react-hover-1440.png") });
    shots.push("thread-react-hover-1440.png");
    await desk.mouse.move(0, 0);
  }
  if (flag("react")) {
    // The first quick reaction of the hover toolbar, clicked: it should turn into a chip under the message.
    await target.hover();
    await target
      .locator("[data-message-toolbar] [data-quick-react]")
      .first()
      .click();
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
    // Text selected in the field: the line with the shortcuts shows above it.
    await field.click();
    await field.fill("Selecione um texto para formatar");
    await field.evaluate((node: HTMLTextAreaElement) =>
      node.setSelectionRange(10, 15),
    );
    await field.dispatchEvent("select");
    await desk.locator("[data-format-hints]").waitFor();
    await desk.waitForTimeout(300);
    await desk.screenshot({ path: join(out, "hints-1440.png") });
    shots.push("hints-1440.png");
    await field.fill("");
  }
  if (flag("studio")) {
    // Studio agents (Settings › Cloud): the deco Studio card before and after connecting, and an agent in the room.
    // Needs `bun scripts/studio-mock.ts` and STUDIO_ORIGIN=http://127.0.0.1:8798 in .dev.vars.
    const cloud = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    const card = cloud.locator("[data-studio-connection]");
    const shot = async (file: string) => {
      await card.scrollIntoViewIfNeeded();
      await cloud.mouse.move(0, 0);
      await cloud.waitForTimeout(400);
      await cloud.screenshot({ path: join(out, file) });
      shots.push(file);
    };
    // A second run starts from "not connected" again.
    await fetch(`${base}/api/studio`, {
      method: "DELETE",
      headers: { origin: base },
    });
    await cloud.goto(`${base}/settings?room=${room}#cloud`, {
      waitUntil: "networkidle",
    });
    await card.waitFor();
    await shot("studio-disconnected-1440.png");
    await card.locator('a[href^="/api/studio/signin"]').click();
    await cloud.locator("[data-studio-create]").waitFor();
    await shot("studio-connected-1440.png");
    // The organization is picked in its searchable list; its projects load right after.
    await cloud.locator("[data-studio-org] button").click();
    await cloud.getByRole("option", { name: "Example Org" }).click();
    await cloud.locator("[data-studio-projects] button").waitFor();
    await cloud.locator("[data-studio-create]").click();
    await cloud
      .locator("[data-sandbox-id]", { hasText: "org-example-agent" })
      .waitFor();
    await cloud.waitForTimeout(1500);
    await shot("studio-agent-1440.png");
    // The owner names the agent in the room: the mock must receive that one message.
    await send(desk, "@org-example-agent liste as tarefas abertas.");
    await desk.waitForTimeout(1500);
    const sent = (
      (await (
        await fetch(
          `${process.env.STUDIO_ORIGIN ?? "http://127.0.0.1:8798"}/_log`,
        )
      ).json()) as { path: string; body: unknown }[]
    ).filter(
      (call) =>
        call.path.endsWith("/messages") &&
        JSON.stringify(call.body).includes(`room_id ${room}`),
    ).length;
    if (sent !== 1)
      throw new Error(`the Studio mock received ${sent} messages, not 1`);
    // A project's agent: it takes the project's title in Studio as its name and @handle.
    await cloud.locator("[data-studio-projects] button").click();
    await cloud.getByRole("option", { name: "Example Store" }).click();
    await cloud.locator("[data-studio-create]").click();
    const project = cloud.locator("[data-sandbox-id]", {
      hasText: "example-store",
    });
    await project.waitFor();
    await cloud.waitForTimeout(1500);
    await project.scrollIntoViewIfNeeded();
    await cloud.screenshot({
      path: join(out, "studio-project-agent-1440.png"),
    });
    shots.push("studio-project-agent-1440.png");
    // The two confirmations: remove one agent from the room, remove the Studio connection.
    const remove = /^(Remove|Remover)$/;
    const dialog = cloud.getByRole("alertdialog").or(cloud.getByRole("dialog"));
    await project.getByRole("button", { name: remove }).click();
    await dialog.first().waitFor();
    await cloud.waitForTimeout(400);
    await cloud.screenshot({ path: join(out, "studio-remove-agent-1440.png") });
    shots.push("studio-remove-agent-1440.png");
    await cloud.keyboard.press("Escape");
    await dialog.first().waitFor({ state: "hidden" });
    await card.getByRole("button", { name: remove }).click();
    await dialog.first().waitFor();
    await cloud.waitForTimeout(400);
    await cloud.screenshot({
      path: join(out, "studio-remove-connection-1440.png"),
    });
    shots.push("studio-remove-connection-1440.png");
    await cloud.keyboard.press("Escape");
    await cloud.close();
    const phone = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await phone.goto(`${base}/settings?room=${room}#cloud`, {
      waitUntil: "networkidle",
    });
    await phone.locator("[data-studio-create]").waitFor();
    await phone.locator("[data-studio-connection]").scrollIntoViewIfNeeded();
    await phone.waitForTimeout(600);
    await phone.screenshot({ path: join(out, "studio-390.png") });
    shots.push("studio-390.png");
    await phone.close();
  }
  if (flag("settings")) {
    // Settings › Cloud agents: the section stays drawn while /api/me refreshes, and each state of the Studio
    // pickers. The Studio reads go through the Worker with the person's grant, so the page's own routes are
    // stubbed here with fake test organizations and projects: no Studio (or its mock) is needed.
    const orgs = [
      "Example Org",
      "Exemplo Testes",
      "Demo Org Alpha",
      "Demo Org Beta",
      "Fixture Labs",
      "Sample Agency",
      "Test Org Empty",
      "Test Org Error",
      "Test Org Slow",
      "Placeholder Co",
      "Org de Exemplo",
      "Mock Studio Team",
    ].map((title) => ({
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: title,
    }));
    const projects = Array.from({ length: 24 }, (_, i) => ({
      id: `vir_test_${i + 1}`,
      title: [
        "Example Store",
        "Example Blog",
        "Test Landing Page",
        "Demo Checkout",
        "Sample Docs",
        "Fixture Dashboard",
      ][i % 6]!.concat(i < 6 ? "" : ` ${Math.floor(i / 6) + 1}`),
    }));
    let release = () => {};
    const stub = async (page: Page) => {
      await page.route("**/api/books/*/sandboxes", (route) =>
        route.request().method() === "GET"
          ? route.fulfill({
              json: {
                connected: false,
                claude: false,
                studio: true,
                studio_orgs: orgs,
                sandboxes: [],
              },
            })
          : route.fallback(),
      );
      await page.route("**/api/studio/orgs/*/projects", async (route) => {
        const org = new URL(route.request().url()).pathname.split("/")[4];
        if (org === "test-org-error")
          return route.fulfill({
            status: 502,
            json: { error: "studio unavailable (test)" },
          });
        if (org === "test-org-slow")
          await new Promise<void>((resolve) => (release = resolve));
        return route.fulfill({
          json: { projects: org === "test-org-empty" ? [] : projects },
        });
      });
    };
    for (const [width, height, tag] of [
      [1440, 900, "1440"],
      [390, 844, "390"],
    ] as const) {
      const page = await browser.newPage({
        viewport: { width, height },
        ...(width < 800 ? { isMobile: true, hasTouch: true } : {}),
      });
      await stub(page);
      const studio = page.locator("[data-studio-connection]");
      // Puts a part at the top of its scrolled page, under the phone's bar.
      const top = (at: typeof studio) =>
        at.evaluate((node) => {
          node.scrollIntoView({ block: "start" });
          let box = node.parentElement;
          while (box && box.scrollHeight <= box.clientHeight)
            box = box.parentElement;
          (box ?? document.scrollingElement)?.scrollBy(0, -72);
        });
      const shot = async (file: string, at = studio) => {
        await top(at);
        await page.mouse.move(0, 0);
        await page.waitForTimeout(400);
        await page.screenshot({ path: join(out, `${file}-${tag}.png`) });
        shots.push(`${file}-${tag}.png`);
      };
      const closed = () =>
        page.getByRole("option").first().waitFor({ state: "detached" });
      const pick = async (org: string) => {
        await page.locator("[data-studio-org] button").click();
        await page.getByRole("option", { name: org, exact: true }).click();
        await closed();
      };
      await page.goto(`${base}/settings?room=${room}#cloud`, {
        waitUntil: "networkidle",
      });
      const section = page.locator("#cloud");
      await studio.waitFor();
      // The cloud agents section, then a /api/me refresh: it must keep the same panel and the typed text.
      const field = page
        .locator("[data-sandboxes] input[type=password]")
        .first();
      await field.fill("texto de teste");
      await page.evaluate(() => {
        const panel = document.querySelector("[data-sandboxes]");
        (window as unknown as { panel: Element | null }).panel = panel;
      });
      // Opening a room in another tab makes this page read /api/me again.
      const refreshed = page.waitForRequest(
        (request) => new URL(request.url()).pathname === "/api/me",
      );
      const other = await browser.newPage();
      await other.goto(`${base}/b/${room}`, { waitUntil: "networkidle" });
      await refreshed;
      await page.waitForTimeout(1500);
      await other.close();
      const kept = await page.evaluate(
        () =>
          (window as unknown as { panel: Element | null }).panel ===
          document.querySelector("[data-sandboxes]"),
      );
      if (!kept || (await field.inputValue()) !== "texto de teste")
        throw new Error("the cloud agents panel was drawn again");
      await field.fill("");
      await field.blur();
      await shot("cloud", section);
      await shot("studio-org-closed");
      await page.locator("[data-studio-org] button").click();
      await page.keyboard.type("demo");
      await page.getByRole("option", { name: "Demo Org Beta" }).waitFor();
      await shot("studio-org-search");
      await page.keyboard.press("Escape");
      await closed();
      await pick("Test Org Slow");
      await page.locator('[data-studio-projects] [role="status"]').waitFor();
      await shot("studio-projects-loading");
      release();
      await pick("Example Org");
      // The card at the top of the page, so the list opens under the field and the organization stays in view.
      await top(studio);
      await page.locator("[data-studio-projects] button").click();
      await page.getByRole("option", { name: "Fixture Dashboard 4" }).waitFor();
      await shot("studio-projects");
      await page.keyboard.press("Escape");
      await closed();
      await pick("Test Org Empty");
      await page
        .locator("[data-studio-projects]", {
          hasText: /no projects|não tem projetos/,
        })
        .waitFor();
      await shot("studio-projects-empty");
      await pick("Test Org Error");
      await page.locator('[data-studio-projects] [role="alert"]').waitFor();
      await shot("studio-projects-error");
      await page.close();
    }
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
  if (flag("threads")) {
    // The sidebar's tabs Mine, Open and Done (Viktor): one room with threads of each kind, one where none is yours and
    // none is done. Each tab at 1440 px, and in the phone's drawer at 390 px.
    const domain =
      ((await me.clone().json()) as { email: string }).email.split("@")[1] ??
      "";
    const colleague = `bia@${domain}`;
    await $`bunx wrangler d1 execute chat --local --command ${`INSERT OR IGNORE INTO users (email, name) VALUES ('${colleague}', 'Bia de Teste')`}`.quiet();
    const full = await threadRoom(
      "Sala com threads",
      [
        { id: "a0000001", title: "Revisar o fluxo de cadastro", pinned: true },
        {
          id: "a0000002",
          title: "Atualizar a página de preços",
          theirs: true,
          status: "doing",
        },
        { id: "a0000003", title: "Preparar a demo de sexta", status: "doing" },
        {
          id: "a0000004",
          title: "Escrever o guia de onboarding",
          theirs: true,
        },
        {
          id: "a0000005",
          title: "Corrigir o upload de imagens",
          status: "review",
        },
        { id: "a0000006", title: "Configurar o domínio de teste", done: true },
        {
          id: "a0000007",
          title: "Migrar os testes antigos",
          theirs: true,
          done: true,
        },
      ],
      desk,
      colleague,
    );
    const none = await threadRoom(
      "Sala sem threads suas",
      [
        {
          id: "b0000001",
          title: "Atualizar a página de preços",
          theirs: true,
          status: "doing",
        },
      ],
      desk,
      colleague,
    );
    const phone = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    for (const [id, tabs] of [
      [full, ["mine", "open", "done"]],
      [none, ["mine", "done"]],
    ] as const) {
      const empty = id === none ? "-empty" : "";
      await desk.goto(`${base}/b/${id}`, { waitUntil: "networkidle" });
      await phone.goto(`${base}/b/${id}`, { waitUntil: "networkidle" });
      for (const tab of tabs) {
        await desk.locator(`[data-threads-tab=${tab}]`).click();
        await desk.mouse.move(0, 0);
        await desk.waitForTimeout(400);
        await desk.screenshot({
          path: join(out, `threads-${tab}${empty}-1440.png`),
        });
        shots.push(`threads-${tab}${empty}-1440.png`);
        // The drawer keeps the tab: the desktop's pick is stored per room on this device, the phone's is its own.
        await phone.locator("[data-phone-title]").tap();
        await phone.locator(`[data-threads-tab=${tab}]`).tap();
        await phone.waitForTimeout(400);
        await phone.screenshot({
          path: join(out, `threads-${tab}${empty}-390.png`),
        });
        shots.push(`threads-${tab}${empty}-390.png`);
        await phone.keyboard.press("Escape");
        await phone.waitForTimeout(300);
      }
    }
  }
  if (flag("resume")) {
    // Coming back to a room, and your last threads (Viktor), at 1440 and 390 px, with a video of each. Six threads
    // (A to F) from six messages, E pinned. Thread A holds a link to "Outra sala de teste" (a phone leaves a thread
    // only to the room's main or by a link), and that room holds a link to thread B and one to that message in A.
    // Then, in a new tab: open A, leave, come back (A opens again); open B and C, A again, then D. The sidebar keeps
    // one order through all of it: the pinned E, then newest made first, F D C B A (Gimenes #5603). Follow the two
    // links (they go where they say, not to the thread you left); click the room you are in (main). Each step fails
    // the run when the app does something else.
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
      await act(message, "data-start-thread");
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
      await expectOrder([e, f, d, c, b, a], "after opening B and C");
      await shot("4-recent");
      await openThread(a);
      await drawer();
      await expectOrder([e, f, d, c, b, a], "after opening A again");
      await shot("5-no-reorder");
      await openThread(d);
      await drawer();
      await expectOrder([e, f, d, c, b, a], "after opening D");
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
  if (flag("search")) await searchScreens(browser, shots);
  if (flag("threadmenu")) await threadMenuScreens(browser, shots);
  if (flag("topbar")) await topbarScreens(browser, shots);
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
    if (path === "/") {
      // The home's + opens a sheet from the bottom, the screen's width (Gimenes #6146, #6161).
      await phone.locator("[data-home-new]").click();
      await phone.locator("[data-new-message-sheet]").waitFor();
      await phone.waitForTimeout(400);
      await phone.screenshot({ path: join(out, "home-new-390.png") });
      shots.push("home-new-390.png");
    }
  }
  if (flag("center")) {
    // The user center with rows (Gimenes, step 4): a new version, an invite and a message request, faked in the
    // page's answers (test data only), and notifications that this device never turned on.
    const fake = async (page: Page) => {
      // Headless Chromium answers "denied"; a device that never chose answers "default".
      await page.addInitScript(() =>
        Object.defineProperty(Notification, "permission", {
          get: () => "default",
        }),
      );
      // A version that is not the page's own: the app offers the new version.
      await page.route(/\/api\/me(\?|$)/, async (route) => {
        const response = await route.fetch();
        const me = (await response.json()) as Record<string, unknown>;
        await route.fulfill({
          response,
          json: {
            ...me,
            v: "screens-new",
            invites: [
              {
                book_id: "zzzzzz",
                title: "Viagem de teste",
                icon: null,
                inviter: "bia@example.test",
                inviter_name: "Bia Teste",
                inviter_avatar: null,
                people: 3,
                created_at: Date.now(),
              },
            ],
            requests: [
              {
                email: "caio@example.test",
                name: "Caio Teste",
                avatar: null,
                msg: "Oi! Posso falar com você?",
              },
            ],
          },
        });
      });
    };
    for (const scheme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        colorScheme: scheme,
      });
      const phone = await context.newPage();
      await fake(phone);
      await phone.goto(`${base}/`, { waitUntil: "networkidle" });
      await phone.locator('[data-user-center="phone"]').waitFor();
      await phone
        .locator('[data-user-center="phone"] [data-view="update"]')
        .waitFor();
      await phone.waitForTimeout(400);
      await phone.screenshot({
        path: join(out, `center-chats-${scheme}-390.png`),
      });
      shots.push(`center-chats-${scheme}-390.png`);
      await phone.goto(`${base}/b/${room}`, { waitUntil: "networkidle" });
      await phone.locator("[data-phone-back] [data-count]").waitFor();
      await phone.waitForTimeout(400);
      await phone.screenshot({
        path: join(out, `center-room-${scheme}-390.png`),
      });
      shots.push(`center-room-${scheme}-390.png`);
      await context.close();
    }
    // Desktop with the same rows: the sidebar's user center, as before.
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const wide = await context.newPage();
    await fake(wide);
    await wide.goto(`${base}/b/${room}`, { waitUntil: "networkidle" });
    await wide.locator("[data-user-center] [data-view='update']").waitFor();
    await wide.waitForTimeout(400);
    await wide.screenshot({ path: join(out, "center-room-1440.png") });
    shots.push("center-room-1440.png");
    await context.close();
  }
  if (flag("audio")) {
    // The call's microphone and audio output, in the "Mais opções" menu of the stage. A real call needs the SFU,
    // so this opens the call's gallery fixture (web/dev/gallery/CallFixture.svelte, built into dist-gallery/) with
    // test devices in place of enumerateDevices. `output: false` is a browser without setSinkId (Safari, Firefox).
    await $`bun run build:gallery`.quiet();
    const gallery = await serveBuiltGallery("dist-gallery");
    const fixture = `${gallery.base}${galleryPath}?probe=call&n=3&speaking=2`;
    const devices = (page: Page, output: boolean) =>
      page.addInitScript(
        ({ output }) => {
          const list = [
            ["audioinput", "default", "Padrão - Microfone integrado", "g0"],
            ["audioinput", "mic-built-in", "Microfone integrado", "g0"],
            ["audioinput", "mic-headset", "Headset USB de teste", "g1"],
            ["audioinput", "mic-webcam", "Microfone da webcam de teste", "g2"],
            ["audiooutput", "default", "Padrão - Alto-falantes", "g0"],
            ["audiooutput", "out-built-in", "Alto-falantes integrados", "g0"],
            ["audiooutput", "out-headset", "Headset USB de teste", "g1"],
            ["audiooutput", "out-display", "Monitor HDMI de teste", "g3"],
          ].map(([kind, deviceId, label, groupId]) => ({
            kind,
            deviceId,
            label,
            groupId,
          }));
          navigator.mediaDevices.enumerateDevices = async () =>
            list as unknown as MediaDeviceInfo[];
          if (!output)
            delete (HTMLMediaElement.prototype as Partial<HTMLMediaElement>)
              .setSinkId;
        },
        { output },
      );
    const openMenu = async (page: Page) => {
      await page.locator("[data-call-more]").click();
      await page.locator("[data-call-mics]").waitFor();
      await page.waitForTimeout(400);
    };
    const checked = (page: Page, list: string, id: string) =>
      page
        .locator(
          `[data-call-${list}] [data-call-device="${id}"][data-state="checked"]`,
        )
        .waitFor();
    try {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      const wide = await context.newPage();
      await devices(wide, true);
      await wide.goto(fixture, { waitUntil: "networkidle" });
      await openMenu(wide);
      await checked(wide, "mics", "system");
      await checked(wide, "speakers", "system");
      await wide.screenshot({ path: join(out, "audio-menu-1440.png") });
      shots.push("audio-menu-1440.png");
      // Choose the headset for the two; each choice closes the menu.
      await wide
        .locator('[data-call-mics] [data-call-device="mic-headset"]')
        .click();
      await openMenu(wide);
      await wide
        .locator('[data-call-speakers] [data-call-device="out-headset"]')
        .click();
      // The choice stays on this device: after a reload the menu still has it.
      await wide.reload({ waitUntil: "networkidle" });
      await openMenu(wide);
      await checked(wide, "mics", "mic-headset");
      await checked(wide, "speakers", "out-headset");
      await wide.screenshot({ path: join(out, "audio-chosen-1440.png") });
      shots.push("audio-chosen-1440.png");
      await context.close();

      const plain = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      const noSink = await plain.newPage();
      await devices(noSink, false);
      await noSink.goto(fixture, { waitUntil: "networkidle" });
      await openMenu(noSink);
      if (await noSink.locator("[data-call-speakers]").count())
        throw new Error("the output list shows without setSinkId");
      await noSink.screenshot({ path: join(out, "audio-no-output-1440.png") });
      shots.push("audio-no-output-1440.png");
      await plain.close();

      const small = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      const phone = await small.newPage();
      await devices(phone, true);
      await phone.goto(`${fixture}&phone=1`, { waitUntil: "networkidle" });
      await openMenu(phone);
      const box = await phone
        .locator('[data-slot="dropdown-menu-content"]')
        .boundingBox();
      if (!box || box.x < 0 || box.x + box.width > 390)
        throw new Error("the menu does not fit the phone's width");
      await phone.screenshot({ path: join(out, "audio-menu-390.png") });
      shots.push("audio-menu-390.png");
      await small.close();
    } finally {
      gallery.server.stop(true);
    }
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
 * Then "Copiar" in the bar, at both widths: the bar with Copiar, and the room's "Copiado" after the copy. The run
 * fails if the clipboard does not hold the package.
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
    permissions: ["clipboard-read", "clipboard-write"],
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
  await act(row(desk, "Dá sim. A primeira"), "data-start-thread");
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
  // Only the person sends it (Enter): how the forward reads in the destination room.
  await desk.locator("[data-composer] textarea").first().press("End");
  await desk.keyboard.press("Enter");
  await row(desk, "Encaminhado de").waitFor();
  await desk.mouse.move(0, 0);
  await shot(desk, "forward-sent-1440.png");
  // "Copiar": back in the source room, three messages to the clipboard.
  const copied = async (page: Page, pt: boolean) => {
    await page
      .locator("aside[role=status]", { hasText: pt ? "Copiado" : "Copied" })
      .waitFor();
    await page.locator("[data-forward-bar]").waitFor({ state: "detached" });
    const text = await page.evaluate(() => navigator.clipboard.readText());
    const head = pt ? "Encaminhado de Evento de fim de ano" : "Forwarded from";
    const file = pt ? "> Anexo: plano-do-evento.png" : "> Attachment:";
    if (!text.startsWith(head) || !text.includes(file))
      throw new Error(`Copiar: the clipboard holds ${JSON.stringify(text)}`);
  };
  await desk.goto(`${base}/b/${source}`, { waitUntil: "networkidle" });
  await row(desk, "Combinado. Obrigada").waitFor();
  await row(desk, "fechei o orçamento").hover();
  await row(desk, "fechei o orçamento").locator("[data-forward]").click();
  await desk.locator("[data-forward-bar] [role=toolbar]").waitFor();
  await row(desk, "Dá sim. A primeira").click();
  await row(desk, "Segue o plano").click();
  await desk.locator("[data-forward-copy]").hover();
  await shot(desk, "forward-copy-1440.png");
  await desk.locator("[data-forward-copy]").click();
  await copied(desk, true);
  await desk.mouse.move(0, 0);
  await shot(desk, "forward-copied-1440.png");
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
  // It can sit above the fold at 390 px: a touch off screen holds nothing.
  await held.scrollIntoViewIfNeeded();
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
  // Filtered, as on desktop: a dev database with many test rooms lists the new one past the first rooms.
  await phone.keyboard.type("destino");
  await phone.locator(`[data-forward-target="${target}:main"]`).tap();
  await phone.waitForURL(new RegExp(`/b/${target}`));
  await filled(phone);
  await shot(phone, "forward-composer-390.png");
  // "Copiar" on the phone: the bar shows its icon only.
  await phone.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await phone.goto(`${base}/b/${source}`, { waitUntil: "networkidle" });
  await row(phone, "Combinado. Obrigada").waitFor();
  await row(phone, "fechei o orçamento").scrollIntoViewIfNeeded();
  const again = (await row(phone, "fechei o orçamento").boundingBox())!;
  const at = [{ x: again.x + again.width / 2, y: again.y + again.height / 2 }];
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: at,
  });
  await phone.waitForTimeout(700);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await phone.locator("[data-sheet-forward]").tap();
  await phone.locator("[data-forward-bar] [role=toolbar]").waitFor();
  await row(phone, "Dá sim. A primeira").tap();
  await row(phone, "Segue o plano").tap();
  await shot(phone, "forward-copy-390.png");
  await phone.locator("[data-forward-copy]").tap();
  await copied(phone, false);
  await shot(phone, "forward-copied-390.png");
}

/**
 * The room's search (--search): words, a person alone, both, and the column after the search is cleared, at 1440 px
 * (Portuguese) and 390 px (English). Two test people talk in a new room (Bruno joins with the dev_as cookie). Each
 * way to clear (×, Esc, Backspace to empty) is checked: the run fails if the Search pane stays open, or if the pane
 * that was open before (the doc) does not come back.
 */
async function searchScreens(
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
  const { id: room } = await post("/api/books", { title: "Projeto Aurora" });
  await post(`/api/books/${room}/members`, { email: bruno });
  await post("/api/me", { name: "Bruno Lima" }, bruno);
  await post(`/api/books/${room}/invite`, { yes: true }, bruno);
  const say = (text: string, email?: string) =>
    post(`/api/books/${room}/post`, { text, thread: "main" }, email);
  await say("Bom dia! Hoje sai o deploy da versão nova do site?");
  await say("Sai sim, o deploy fica pra depois do almoço.", bruno);
  await say("Combinado. Eu reviso o texto da página inicial antes.");
  await say("Atualizei as fotos da página de contato.", bruno);
  await say("O deploy terminou, já está no ar.", bruno);
  await say("Perfeito! Vou avisar o cliente.");
  await say("Amanhã eu olho os números de acesso.", bruno);
  const shot = async (page: Page, file: string) => {
    await page.mouse.move(0, 0);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(out, file) });
    shots.push(file);
  };
  const settled = async (page: Page, count: number) => {
    await page.waitForFunction(
      (n) => document.querySelectorAll("[data-search-hit]").length === n,
      count,
    );
    // The server's page lands after the loaded matches: wait for the spinner to go.
    await page.waitForTimeout(700);
  };
  /** After a clear: the Search pane is gone, and the column is as it was (`pane`: the pane open before, or none). */
  const closed = async (page: Page, how: string, pane?: string) => {
    await page.waitForTimeout(300);
    if (await page.locator("[data-room-search]").isVisible())
      throw new Error(`${how}: the Search pane stayed open`);
    const open = await page.locator("[data-room-document]").isVisible();
    const now = await page
      .locator("[data-room-layout]")
      .getAttribute("data-pane");
    if (pane ? !open || now !== pane : open)
      throw new Error(
        `${how}: the right column is ${open ? now : "closed"}, not ${pane ?? "closed"}`,
      );
  };

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "pt-BR",
  });
  const desk = await context.newPage();
  await desk.goto(`${base}/b/${room}`, { waitUntil: "networkidle" });
  await desk
    .locator("[data-chat-message]", { hasText: "números de acesso" })
    .first()
    .waitFor();
  // Start with the pane closed, as in the report: the chat has all the width.
  const toggle = async () => {
    await desk.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await desk.keyboard.press(
      process.platform === "darwin" ? "Meta+Alt+KeyB" : "Control+Alt+KeyB",
    );
    await desk.waitForTimeout(400);
  };
  await desk.waitForTimeout(500);
  if (await desk.locator("[data-room-document]").isVisible()) await toggle();
  if (await desk.locator("[data-room-document]").isVisible())
    throw new Error("the pane did not close before the search");
  const field = desk.locator("[data-room-search-field] input");
  await field.fill("deploy");
  await settled(desk, 3);
  await shot(desk, "search-text-1440.png");
  await desk.locator("[data-search-people]").click();
  await desk.locator("[data-search-people-list]").waitFor();
  await shot(desk, "search-people-1440.png");
  await desk.locator(`[data-search-person-option="${bruno}"]`).click();
  await settled(desk, 2);
  await shot(desk, "search-text-person-1440.png");
  await field.fill("");
  await settled(desk, 4);
  await shot(desk, "search-person-1440.png");
  // × clears the words and the person: the Search pane closes, and the chat has its width back.
  await desk
    .locator("[data-room-search-field] [aria-label='Limpar busca']")
    .click();
  await closed(desk, "×");
  await shot(desk, "search-cleared-1440.png");
  await field.fill("deploy");
  await settled(desk, 3);
  await field.press("Escape");
  await closed(desk, "Esc");
  await field.fill("de");
  await desk.locator("[data-room-search]").waitFor();
  await field.press("Backspace");
  await field.press("Backspace");
  await closed(desk, "Backspace");
  // The doc was open before the search: clearing brings it back.
  await toggle();
  const before = await desk
    .locator("[data-room-layout]")
    .getAttribute("data-pane");
  // The panel toggle opens the pane that was there, not an empty Search pane.
  if (
    before === "search" ||
    (await desk.locator("[data-room-search]").isVisible())
  )
    throw new Error("the panel toggle opened the empty Search pane");
  await field.fill("deploy");
  await settled(desk, 3);
  await field.fill("");
  await closed(desk, "doc open before", before ?? "doc");
  await shot(desk, "search-cleared-doc-1440.png");
  await context.close();

  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await phone.goto(`${base}/b/${room}`, { waitUntil: "networkidle" });
  await phone
    .locator("[data-chat-message]", { hasText: "numbers" })
    .or(phone.locator("[data-chat-message]", { hasText: "números de acesso" }))
    .first()
    .waitFor();
  await phone.locator("[data-phone-search]").tap();
  await phone.locator("[data-room-search] [data-room-search-field]").waitFor();
  await shot(phone, "search-phone-390.png");
  await phone.locator("[data-room-search] [data-search-people]").tap();
  await phone.locator(`[data-search-person-option="${bruno}"]`).tap();
  await settled(phone, 4);
  await shot(phone, "search-phone-person-390.png");
  await phone
    .locator("[data-room-search] [data-room-search-field] input")
    .fill("deploy");
  await settled(phone, 2);
  await shot(phone, "search-phone-text-person-390.png");
  // A tap on a match closes the sheet and shows the message in the chat.
  await phone.locator("[data-search-hit]").first().tap();
  await phone.waitForTimeout(800);
  if (await phone.locator("[data-room-search]").isVisible())
    throw new Error(
      "phone: the Search pane stayed over the chat after a tap on a match",
    );
  await shot(phone, "search-phone-jump-390.png");
}

/**
 * A thread row's menu in the sidebar (--threadmenu): a right-click at 1440 px, "Copiar link da thread" and the
 * room's "Copiado", "Marcar como feita" (the thread and its open tasks are done; it leaves Open), then the Done tab
 * with "Reabrir thread". At 390 px a long press in the drawer opens the same menu (the thread does not open, the
 * drawer stays), then "Mark as done".
 * The run fails if the clipboard does not hold the thread's link or the thread does not move to Done.
 */
async function threadMenuScreens(
  browser: import("playwright").Browser,
  shots: string[],
) {
  const domain =
    (
      (await (await fetch(`${base}/api/me`)).json()) as { email: string }
    ).email.split("@")[1] ?? "";
  const colleague = `bia@${domain}`;
  await $`bunx wrangler d1 execute chat --local --command ${`INSERT OR IGNORE INTO users (email, name) VALUES ('${colleague}', 'Bia de Teste')`}`.quiet();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "pt-BR",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const desk = await context.newPage();
  const thread = "c0000003";
  const id = await threadRoom(
    "Sala com threads",
    [
      { id: "c0000001", title: "Revisar o fluxo de cadastro", pinned: true },
      {
        id: "c0000002",
        title: "Atualizar a página de preços",
        theirs: true,
        status: "doing",
      },
      { id: thread, title: "Preparar a demo de sexta", status: "doing" },
      { id: "c0000004", title: "Escrever o guia de onboarding" },
      { id: "c0000005", title: "Configurar o domínio de teste", done: true },
    ],
    desk,
    colleague,
  );
  await commands(desk, id, [
    { t: "task.add", epic: thread, title: "Montar o roteiro" },
    { t: "task.add", epic: thread, title: "Gravar o vídeo" },
  ]);
  const shot = async (page: Page, file: string) => {
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(out, file) });
    shots.push(file);
  };
  const row = (page: Page, epic: string) =>
    page.locator(`[data-room-sidebar] [data-epic-thread="${epic}"]`);
  const menu = (page: Page) => page.locator(`[data-thread-menu="${thread}"]`);
  await desk.goto(`${base}/b/${id}`, { waitUntil: "networkidle" });
  await desk.locator("[data-threads-tab=open]").click();
  await row(desk, thread).waitFor();
  await row(desk, thread).click({ button: "right" });
  await menu(desk).waitFor();
  await shot(desk, "threadmenu-open-1440.png");
  await menu(desk).locator("[data-thread-menu-link]").click();
  await desk.locator("aside[role=status]", { hasText: "Copiado" }).waitFor();
  const link = await desk.evaluate(() => navigator.clipboard.readText());
  if (link !== `${base}/b/${id}?t=${thread}`)
    throw new Error(`Copiar link: the clipboard holds ${JSON.stringify(link)}`);
  await shot(desk, "threadmenu-copied-1440.png");
  await row(desk, thread).click({ button: "right" });
  await menu(desk).locator("[data-thread-menu-status=done]").click();
  await row(desk, thread).waitFor({ state: "detached" });
  await desk
    .locator("aside[role=status]", { hasText: "Thread marcada como feita" })
    .waitFor();
  await desk.mouse.move(0, 0);
  await shot(desk, "threadmenu-done-open-tab-1440.png");
  await desk.locator("[data-threads-tab=done]").click();
  await row(desk, thread).waitFor();
  await row(desk, thread).click({ button: "right" });
  await menu(desk).locator("[data-thread-menu-status=reopen]").waitFor();
  await shot(desk, "threadmenu-done-tab-reopen-1440.png");
  await desk.keyboard.press("Escape");
  await context.close();

  // Phone: the drawer's rows, a long press on one.
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const other = "c0000004";
  await phone.goto(`${base}/b/${id}`, { waitUntil: "networkidle" });
  await phone.locator("[data-phone-title]").tap();
  await phone.locator("[data-threads-tab=open]").tap();
  await row(phone, other).waitFor();
  const box = (await row(phone, other).boundingBox())!;
  const cdp = await phone.context().newCDPSession(phone);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  });
  await phone.waitForTimeout(700);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await phone.locator(`[data-thread-menu="${other}"]`).waitFor();
  await phone.waitForTimeout(300);
  if (new URL(phone.url()).searchParams.get("t") === other)
    throw new Error("long press: the thread opened under its menu");
  await shot(phone, "threadmenu-longpress-390.png");
  await phone
    .locator(`[data-thread-menu="${other}"] [data-thread-menu-status=done]`)
    .tap();
  await row(phone, other).waitFor({ state: "detached" });
  await shot(phone, "threadmenu-done-390.png");
  await phone.close();
}

/**
 * The desktop top bar (--topbar, Gimenes #6099, #6113, #6122) at 1440 x 700 px: the room's name stays on top while
 * the sidebar scrolls, ⋮ holds the call and the panes, the chip names the open pane and × closes it, and in a thread
 * ← goes back to the main thread.
 * The run fails if the name scrolls away, the chip does not close the pane, or ← does not open the main thread.
 */
async function topbarScreens(
  browser: import("playwright").Browser,
  shots: string[],
) {
  const domain =
    (
      (await (await fetch(`${base}/api/me`)).json()) as { email: string }
    ).email.split("@")[1] ?? "";
  const colleague = `bia@${domain}`;
  await $`bunx wrangler d1 execute chat --local --command ${`INSERT OR IGNORE INTO users (email, name) VALUES ('${colleague}', 'Bia de Teste')`}`.quiet();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 700 },
    locale: "pt-BR",
  });
  const desk = await context.newPage();
  const titles = [
    "Revisar o fluxo de cadastro",
    "Atualizar a página de preços",
    "Preparar a demo de sexta",
    "Escrever o guia de onboarding",
    "Configurar o domínio de teste",
    "Trocar o ícone do app",
    "Medir o tempo de carregamento",
    "Corrigir o atalho de busca",
    "Revisar os textos do convite",
    "Testar o modo escuro",
    "Organizar os arquivos da sala",
    "Planejar a próxima versão",
    "Ajustar o e-mail de boas-vindas",
    "Limpar as tarefas antigas",
  ];
  const thread = "d0000014";
  const id = await threadRoom(
    "Sala da topbar",
    titles.map((title, i) => ({
      id: `d00000${String(i + 1).padStart(2, "0")}`,
      title,
      theirs: i % 3 === 1,
      status: i % 2 ? "doing" : undefined,
    })),
    desk,
    colleague,
  );
  await commands(desk, id, [
    { t: "task.add", epic: thread, title: "Montar o roteiro" },
    { t: "task.add", epic: thread, title: "Gravar o vídeo" },
  ]);
  const shot = async (file: string) => {
    await desk.waitForTimeout(400);
    await desk.screenshot({ path: join(out, file) });
    shots.push(file);
  };
  const name = desk.locator("[data-room-sidebar] [data-room-home]");
  await desk.goto(`${base}/b/${id}`, { waitUntil: "networkidle" });
  await name.waitFor();
  // A clean start: no pane open.
  const chip = desk.locator("[data-header-pane-chip]");
  if (await chip.isVisible()) await chip.getByRole("button").click();
  await shot("topbar-main-1440.png");
  const top = (await name.boundingBox())?.y ?? -1;
  await desk
    .locator("[data-room-sidebar-panel]")
    .evaluate((node) => node.scrollTo(0, node.scrollHeight));
  await desk.waitForTimeout(200);
  const after = (await name.boundingBox())?.y ?? -2;
  if (Math.abs(after - top) > 1)
    throw new Error(`the room's name scrolled from ${top} to ${after}`);
  await shot("topbar-sidebar-scrolled-1440.png");
  await desk.locator("[data-desktop-more]").click();
  await desk.locator("[data-desktop-more-menu]").waitFor();
  await shot("topbar-more-open-1440.png");
  await desk.locator('[data-desktop-more-item="doc"]').click();
  await chip.waitFor();
  await shot("topbar-doc-chip-1440.png");
  await chip.getByRole("button").click();
  await chip.waitFor({ state: "hidden" });
  await desk.locator("[data-threads-tab=open]").click();
  await desk
    .locator(`[data-room-sidebar] [data-epic-thread="${thread}"]`)
    .click();
  await desk.waitForURL((url) => url.href.includes(thread));
  await desk.locator("[data-phone-back]").waitFor();
  await shot("topbar-thread-1440.png");
  await desk.locator("[data-desktop-more]").click();
  await desk.locator('[data-desktop-more-item="doc"]').click();
  await chip.waitFor();
  await shot("topbar-thread-doc-chip-1440.png");
  await desk.locator("[data-phone-back]").click();
  await desk.waitForURL((url) => !url.href.includes(thread));
  await shot("topbar-back-main-1440.png");
  await context.close();
}
