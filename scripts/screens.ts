// Screens of a change, taken on local development, for its pull request (Gui #4723: no UI change ships without them).
// Needs `bun run dev` with DEV_EMAIL set (docs/workflow.md, "Screens"). It makes a new test room with test data,
// takes the room and the home at 1440 and 390 px, and a hovered message. With --publish it pushes the files to the
// orphan branch `pr-screens` (no workflow runs there) and prints the Markdown to paste in the pull request.
//
//   bun scripts/screens.ts [--publish] [--hover] [--react] [--link] [--dm] [--threads] [--name <folder>]
import { chromium, type Page } from "playwright";
import { mkdir, cp, mkdtemp, rm } from "node:fs/promises";
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
console.log(`Screens in ${out}: ${shots.join(", ")}`);

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
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
