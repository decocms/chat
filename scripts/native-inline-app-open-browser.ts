// Actual Worker/Book/Auth/MCP/SDK browser gate. Never installs API/WS/canonical mocks.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import {
  expect as baseExpect,
  type APIResponse,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import * as z from "zod/mini";
import {
  CreateConnectionResult,
  ConnectionsResult,
  CreateRoomResult,
  MeResult,
  PostMessageResult,
} from "../shared/schemas";
import { nativeTestAgent } from "./native-test-mcp";
import {
  nativeDocumentMode,
  localBrowserError,
} from "./native-browser-fixtures";
import type { NativeApplicationAuditFixture } from "./native-application-browser-types";
import {
  startInlineAppFixture,
  type InlineVariant,
  type InlineCounters,
  type InlineTool,
} from "./native-inline-app-fixture";
const expect = baseExpect.configure({ timeout: 30000 });
export type InlineAppOpenFixture = Pick<
  NativeApplicationAuditFixture,
  "base" | "ownerEmail" | "output" | "createProfile" | "openPane" | "step"
>;
export type InlineAppOpenEvidence = {
  status: "running" | "passed" | "failed";
  sdk?: { version: string; sha256: string };
  variants: {
    variant: InlineVariant;
    status: "running" | "passed" | "failed";
    phase: string;
    roomId?: string;
    markerSHA256: string;
    snapshots: { phase: string; counters: InlineCounters }[];
    browserRequests: { ui: number; call: number; sdk: number };
    explicitGrants: Record<InlineTool, number>;
    pageErrors: ReturnType<typeof localBrowserError>[];
    replacement?: {
      sameElement: boolean;
      sameWindow: boolean;
      opaque: boolean;
      outcome: string | null;
      direct: string | null;
      negotiated: string | null;
    };
    /** Failure only: what each inline App card showed (tool, state text, button labels). */
    failureCards?: { tool: string; text: string; buttons: string[] }[];
    retainedFramesAfterProse?: boolean;
    documentWidth?: { available: number; card: number };
    agentOpenRequiresReader?: boolean;
    failure?: { name: string; phase: string; sourceLocations?: string[] };
  }[];
  failure?: { name: string; phase: string };
  cleanupFailure?: "server";
  gaps: string[];
};
const snapshot = (value: InlineCounters): InlineCounters => ({
  ...value,
  resources: { ...value.resources },
  initial: { ...value.initial },
});
export async function auditInlineAppOpen(
  fixture: InlineAppOpenFixture,
): Promise<InlineAppOpenEvidence> {
  assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(fixture.base));
  assert(fixture.ownerEmail.endsWith("@example.test"));
  const evidence: InlineAppOpenEvidence = {
    status: "running",
    variants: [],
    gaps: [
      "Real local Worker/Auth/Book/MCP connection/UI resource/private-port/stock-SDK paths; external MCP side effects are synthetic counters, not a production provider.",
      "Author and reader use loopback DEV identity plus real Worker DCR/PKCE grants; remote sign-in executes the Worker discovery/DCR/PKCE/callback path against a synthetic external provider. Email delivery and real-provider login quality remain unverified.",
      "Negative network assertions observe a bounded 600ms plus two animation-frame window after positive canonical/UI readiness, not an unbounded no-event claim.",
      "SDK counter measures the exact installed 1.7.4 child SDK served by the external fixture; parent bundle module attribution is not inferred from chunk names.",
      "Default document HTML may recreate inline frames on prose/size changes; it must ask again and never implicitly replay. Native must preserve existing frame identity.",
      "Desktop Chromium only; hardware, Safari/iOS, IME, production OAuth and actual external mutation semantics remain unverified.",
    ],
  };
  await mkdir(fixture.output, { recursive: true });
  let server: Awaited<ReturnType<typeof startInlineAppFixture>> | null = null;
  try {
    server = await startInlineAppFixture(fixture.base);
    evidence.sdk = server.sdk;
    for (const variant of ["svelte", "vanilla"] as const) {
      const marker = "Inline canonical " + randomBytes(16).toString("hex");
      const result: InlineAppOpenEvidence["variants"][number] = {
        variant,
        status: "running",
        phase: "profile",
        markerSHA256: createHash("sha256").update(marker).digest("hex"),
        snapshots: [],
        browserRequests: { ui: 0, call: 0, sdk: 0 },
        explicitGrants: { mutate_a: 0, mutate_b: 0, mutate_pending: 0 },
        pageErrors: [],
      };
      evidence.variants.push(result);
      let ownerContext: BrowserContext | null = null,
        authorContext: BrowserContext | null = null;
      let counters: InlineCounters | undefined;
      try {
        const owned = await fixture.createProfile({
          lang: "en",
          theme: "light",
          width: 1440,
        });
        ownerContext = owned.context;
        // A vanilla user since Svelte became the default: this device chose vanilla.
        if (variant === "vanilla")
          await ownerContext.addCookies([
            { name: "vb_ui", value: "vanilla", url: fixture.base },
          ]);
        const page = owned.page;
        page.on("pageerror", (error) =>
          result.pageErrors.push(localBrowserError(error, fixture.base)),
        );
        result.phase = "reader-identity";
        const me = MeResult.parse(
          await (
            await ownerContext.request.get(`${fixture.base}/api/me?ui=svelte`)
          ).json(),
        );
        assert.equal(me.email, fixture.ownerEmail);
        result.phase = "reader-oauth";
        const readerAgent = await nativeTestAgent(page, fixture.base);
        result.phase = "create-room";
        const created = await ownerContext.request.post(
          `${fixture.base}/api/books`,
          {
            headers: { origin: fixture.base },
            data: { title: `Inline opening ${variant}` },
          },
        );
        assert(created.ok(), `Create room ${created.status()}`);
        const roomId = CreateRoomResult.parse(await created.json()).id;
        result.roomId = roomId;
        result.phase = "post-marker";
        const posted = await ownerContext.request.post(
          `${fixture.base}/api/books/${roomId}/post`,
          { headers: { origin: fixture.base }, data: { text: marker } },
        );
        assert(posted.ok(), `Post marker ${posted.status()}`);
        assert(PostMessageResult.parse(await posted.json()).ok);
        const remote: { url: string; counters: InlineCounters } =
          server.configure(variant, async () => {
            const value = z
              .object({
                messages: z.array(z.object({ text: z.optional(z.string()) })),
              })
              .parse(
                await readerAgent("read_room", { room_id: roomId, all: true }),
              );
            const text = value.messages.find(
              (message) => message.text === marker,
            )?.text;
            assert(text === marker, "Actual canonical marker missing");
            return text;
          });
        const meter: InlineCounters = remote.counters;
        counters = meter;
        const connResponse: APIResponse = await ownerContext.request.post(
          `${fixture.base}/api/books/${roomId}/connections`,
          {
            headers: { origin: fixture.base },
            data: { url: remote.url, scope: "room" },
          },
        );
        assert(
          connResponse.ok(),
          `Create MCP connection ${connResponse.status()}`,
        );
        const connection = CreateConnectionResult.parse(
          await connResponse.json(),
        ).connection;
        assert(
          connection && connection.needs_sign_in,
          "Controlled external provider must require real sign-in",
        );
        result.phase = "provider-sign-in";
        await page.goto(
          fixture.base +
            `/api/books/${roomId}/connections/${connection.id}/signin` +
            (variant === "svelte" ? "?ui=svelte" : "?ui=vanilla"),
        );
        await expect(page.locator("#fixture-provider-approve")).toBeVisible();
        await page.locator("#fixture-provider-approve").click();
        await page.waitForURL(
          (url) =>
            url.origin === fixture.base && url.pathname === `/b/${roomId}`,
        );
        const catalogResponse = await ownerContext.request.get(
          fixture.base + `/api/books/${roomId}/connections`,
        );
        assert(catalogResponse.ok());
        const signed = ConnectionsResult.parse(
          await catalogResponse.json(),
        ).connections.find((item) => item.id === connection.id);
        assert(signed?.signed_in);
        assert(signed.apps.some((app) => app.tool === "mutate_a"));
        assert(
          !signed.tools.some((tool) => tool.name === "mutate_a"),
          "App-only metadata must exercise absent public read_only field",
        );
        result.snapshots.push({
          phase: "provider-setup-complete",
          counters: snapshot(meter),
        });
        assert.deepEqual(
          meter.initial,
          { mutate_a: 0, mutate_b: 0, mutate_pending: 0 },
          "OAuth callback must not invent an explicit tool Open",
        );
        result.phase = "author-profile";
        const authorEmail = `inline-author-${randomBytes(5).toString("hex")}@example.test`;
        const invited = await ownerContext.request.post(
          `${fixture.base}/api/books/${roomId}/members`,
          { headers: { origin: fixture.base }, data: { email: authorEmail } },
        );
        assert(invited.ok(), `Invite author ${invited.status()}`);
        const author = await fixture.createProfile({
          lang: "en",
          theme: "light",
          width: 1440,
        });
        authorContext = author.context;
        // A vanilla user since Svelte became the default: this device chose vanilla.
        if (variant === "vanilla")
          await authorContext.addCookies([
            { name: "vb_ui", value: "vanilla", url: fixture.base },
          ]);
        const identity = await authorContext.request.get(
          `${fixture.base}/api/dev/as?email=${encodeURIComponent(authorEmail)}`,
        );
        assert(identity.ok());
        assert.equal(
          MeResult.parse(
            await (
              await authorContext.request.get(
                `${fixture.base}/api/me?ui=svelte`,
              )
            ).json(),
          ).email,
          authorEmail,
        );
        // Invites wait for a yes: the author joins.
        const joined = await authorContext.request.post(
          `${fixture.base}/api/books/${roomId}/invite`,
          { headers: { origin: fixture.base }, data: { yes: true } },
        );
        assert(joined.ok(), `Join status ${joined.status()}`);
        const authorAgent = await nativeTestAgent(author.page, fixture.base);
        let doc = `# Inline opening proof\n\n[[app:${connection.id}/mutate_a|m]]\n\n[[app:${connection.id}/mutate_b|m]]\n`;
        const update = async (source: string) => {
          await authorAgent("update_doc", {
            room_id: roomId,
            markdown: source,
          });
          doc = source;
        };
        const canonicalDoc = async () =>
          z
            .object({ doc: z.string() })
            .parse(
              await readerAgent("read_room", { room_id: roomId, all: true }),
            ).doc;
        await update(doc);
        page.on("request", (request) => {
          const url = new URL(request.url());
          if (url.origin === fixture.base) {
            if (
              url.pathname ===
              `/api/books/${roomId}/connections/${connection.id}/ui`
            )
              result.browserRequests.ui++;
            if (
              url.pathname ===
              `/api/books/${roomId}/connections/${connection.id}/call`
            )
              result.browserRequests.call++;
          }
          if (url.pathname.endsWith(`/${variant}/sdk.js`))
            result.browserRequests.sdk++;
        });
        const widget = (tool: InlineTool): Locator =>
          variant === "svelte"
            ? page.locator("[data-document-app]").filter({
                has: page.locator("header > b", {
                  hasText: new RegExp(`^${tool}$`),
                }),
              })
            : page
                .locator(".docApp")
                .filter({ has: page.locator('iframe[title="' + tool + '"]') });
        const button = (tool: InlineTool, label: RegExp) =>
          widget(tool).getByRole("button", { name: label, exact: true });
        const allow = async (tool: InlineTool) => {
          await expect(button(tool, /^(Allow|Permitir)$/)).toBeVisible();
          assert.deepEqual(meter.initial, result.explicitGrants);
          result.explicitGrants[tool]++;
          await button(tool, /^(Allow|Permitir)$/).click();
        };
        const quiet = async () => {
          await page.waitForTimeout(600);
          await page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => resolve()),
                ),
              ),
          );
        };
        const capture = () => {
          result.snapshots.push({
            phase: result.phase,
            counters: snapshot(meter),
          });
        };
        const phase = async (name: string, run: () => Promise<void>) => {
          result.phase = name;
          try {
            await fixture.step(`inline-${variant}: ${name}`, run);
          } catch (error) {
            result.failureCards = await page
              .locator(variant === "svelte" ? "[data-document-app]" : ".docApp")
              .evaluateAll((nodes) =>
                nodes.map((node) => ({
                  tool:
                    node.querySelector("iframe")?.getAttribute("title") ??
                    node.querySelector("header > b")?.textContent ??
                    node.querySelector(".hcName")?.textContent ??
                    "",
                  text: (node as HTMLElement).innerText.slice(0, 200),
                  buttons: [...node.querySelectorAll("button")].map(
                    (button) => button.textContent?.trim() ?? "",
                  ),
                })),
              )
              .catch(() => undefined);
            throw error;
          } finally {
            capture();
          }
        };
        const ready = async (tool: InlineTool) => {
          const frame = widget(tool).frameLocator("iframe");
          await expect(frame.locator("#result")).toHaveAttribute(
            "data-read",
            "ok",
          );
          await expect(frame.locator("#result")).toHaveAttribute(
            "data-initial",
            "received",
          );
          await expect
            .poll(
              async () =>
                (await frame.locator("#result").textContent()) === marker,
            )
            .toBe(true);
          await expect(frame.locator("#result")).toHaveAttribute(
            "data-origin",
            "null",
          );
          const width = await widget(tool).evaluate((node) => {
            const frame = node.querySelector("iframe");
            if (!(frame instanceof HTMLIFrameElement))
              throw Error("Expected current inline iframe");
            return {
              card: node.clientWidth,
              frame: frame.getBoundingClientRect().width,
            };
          });
          assert(
            Math.abs(width.frame - width.card) <= 2,
            "App iframe must fill its card",
          );
        };
        await phase(
          "initial document has no remote execution before reader Allow",
          async () => {
            await page.goto(
              `${fixture.base}/b/${roomId}${variant === "svelte" ? "?ui=svelte" : "?ui=vanilla"}`,
            );
            if (variant === "svelte") {
              await fixture.openPane(page, "doc");
              await nativeDocumentMode(page, "preview");
            } else {
              const tab = page.locator('.ptabs button[data-pane="doc"]');
              await expect(tab).toBeVisible();
              await tab.click();
              const preview = page.locator('.seg button[data-view="preview"]');
              if (await preview.isVisible()) await preview.click();
              await expect(page.locator("#preview")).toBeVisible();
            }
            await expect(widget("mutate_a")).toBeVisible();
            await expect(widget("mutate_b")).toBeAttached();
            await expect(
              button("mutate_a", /^(Allow|Permitir)$/),
            ).toBeVisible();
            // Exercise a document wider than the old chat-card cap with actual controls.
            if (variant === "svelte") {
              const width = page.locator("[data-room-width]");
              await expect(width).toBeVisible();
              await width.focus();
              await width.press("End");
            } else {
              const width = page.locator("#resizer");
              await expect(width).toBeVisible();
              await width.focus();
              for (let i = 0; i < 24; i++) await width.press("ArrowLeft");
            }
            const measureWidth = () =>
              widget("mutate_a").evaluate(
                (node, selector) => {
                  const preview = node.closest(selector);
                  if (!(preview instanceof HTMLElement))
                    throw Error("Document preview missing");
                  const style = getComputedStyle(preview);
                  return {
                    available:
                      preview.clientWidth -
                      parseFloat(style.paddingLeft) -
                      parseFloat(style.paddingRight),
                    card: node.getBoundingClientRect().width,
                  };
                },
                variant === "svelte" ? "[data-document-preview]" : "#preview",
              );
            await expect
              .poll(async () => (await measureWidth()).available)
              .toBeGreaterThan(560);
            await expect
              .poll(async () => {
                const width = await measureWidth();
                return Math.abs(width.card - width.available);
              })
              .toBeLessThanOrEqual(2);
            result.documentWidth = await measureWidth();
            await quiet();
            assert.deepEqual(meter.initial, {
              mutate_a: 0,
              mutate_b: 0,
              mutate_pending: 0,
            });
            assert.deepEqual(meter.resources, {
              mutate_a: 0,
              mutate_b: 0,
              mutate_pending: 0,
            });
            assert.equal(meter.sdk, 0);
            assert.equal(meter.reads, 0);
            assert.deepEqual(result.browserRequests, {
              ui: 0,
              call: 0,
              sdk: 0,
            });
          },
        );
        await phase(
          "Cancel is independent and Reopen requires its own grant",
          async () => {
            await button("mutate_a", /^(Cancel|Cancelar)$/).click();
            await expect(widget("mutate_a")).toContainText(
              /App (?:not opened|não aberto)/,
            );
            await quiet();
            assert.equal(meter.initial.mutate_a, 0);
            assert.equal(meter.resources.mutate_a, 0);
            // The doc can be redrawn right here (a collab status or version
            // event on a slow runner): the cards then start over, mutate_a asks
            // again and mutate_b waits behind it, since only one question is
            // shown at a time. Cancel mutate_a again until mutate_b is asked.
            for (let attempt = 0; attempt < 5; attempt++) {
              const asked = await expect(
                button("mutate_b", /^(Allow|Permitir)$/),
              )
                .toBeVisible({ timeout: 5000 })
                .then(
                  () => true,
                  () => false,
                );
              if (asked) break;
              const again = button("mutate_a", /^(Cancel|Cancelar)$/);
              if (await again.isVisible()) {
                await again.click();
                await expect(widget("mutate_a")).toContainText(
                  /App (?:not opened|não aberto)/,
                );
              }
            }
            await allow("mutate_b");
            await ready("mutate_b");
            assert.equal(meter.initial.mutate_b, 1);
            assert.equal(meter.initial.mutate_a, 0);
            await button("mutate_a", /^(Reopen|Reabrir)$/).click();
            await quiet();
            assert.equal(meter.initial.mutate_a, 0);
            await allow("mutate_a");
            await ready("mutate_a");
            assert.equal(meter.initial.mutate_a, 1);
            assert.equal(meter.initial.mutate_b, 1);
          },
        );
        await phase(
          "prose and real size edits cannot implicitly replay initial tools",
          async () => {
            const a = await widget("mutate_a")
                .locator("iframe")
                .elementHandle(),
              b = await widget("mutate_b").locator("iframe").elementHandle();
            assert(a && b);
            const before = snapshot(meter);
            await update("A different member added prose.\n\n" + doc);
            await expect(
              page.locator(
                variant === "svelte" ? "[data-document-preview]" : "#preview",
              ),
            ).toContainText("A different member added prose.");
            await quiet();
            result.retainedFramesAfterProse =
              (await a.evaluate((node) => node.isConnected)) &&
              (await b.evaluate((node) => node.isConnected));
            if (variant === "svelte")
              assert(
                result.retainedFramesAfterProse,
                "Native prose update remounted an authorized iframe",
              );
            assert.deepEqual(meter.initial, before.initial);
            await button("mutate_a", /^P$/).click();
            await expect
              .poll(async () =>
                (await canonicalDoc()).includes(`/mutate_a|p]]`),
              )
              .toBe(true);
            doc = await canonicalDoc();
            await quiet();
            assert.deepEqual(meter.initial, before.initial);
            if (variant === "svelte") {
              assert(await a.evaluate((node) => node.isConnected));
              assert(await b.evaluate((node) => node.isConnected));
            }
          },
        );
        const grantIfNeeded = async (tool: InlineTool) => {
          await expect
            .poll(async () => {
              if (await button(tool, /^(Allow|Permitir)$/).isVisible())
                return true;
              const output = widget(tool)
                .frameLocator("iframe")
                .locator("#result");
              if ((await output.count()) !== 1) return false;
              return (
                (await output.getAttribute("data-read")) === "ok" &&
                (await output.getAttribute("data-initial")) === "received"
              );
            })
            .toBe(true);
          assert.deepEqual(meter.initial, result.explicitGrants);
          if (await button(tool, /^(Allow|Permitir)$/).isVisible()) {
            const before = meter.initial[tool];
            await allow(tool);
            await ready(tool);
            assert.equal(meter.initial[tool], before + 1);
          }
        };
        await phase(
          "removing an unapproved marker cancels its real pending grant",
          async () => {
            await update(doc + `\n[[app:${connection.id}/mutate_pending|m]]\n`);
            await expect(widget("mutate_pending")).toBeAttached();
            // Default rebuilds its HTML. Real reader actions explicitly regrant only A/B.
            await grantIfNeeded("mutate_a");
            await grantIfNeeded("mutate_b");
            await expect(
              button("mutate_pending", /^(Allow|Permitir)$/),
            ).toBeVisible();
            const old = await button(
              "mutate_pending",
              /^(Allow|Permitir)$/,
            ).elementHandle();
            assert(old);
            await update(
              doc.replace(
                new RegExp(
                  `\\n\\[\\[app:${connection.id}/mutate_pending\\|m\\]\\]\\n$`,
                ),
                "",
              ),
            );
            await expect(widget("mutate_pending")).toHaveCount(0);
            await old.evaluate((node) => {
              if (!(node instanceof HTMLButtonElement))
                throw Error("Expected original Allow button");
              node.click();
            });
            await quiet();
            assert.equal(meter.initial.mutate_pending, 0);
            assert.equal(meter.resources.mutate_pending, 0);
          },
        );
        await phase(
          "approved stock SDK read loses authority after real same-frame replacement",
          async () => {
            await grantIfNeeded("mutate_a");
            await grantIfNeeded("mutate_b");
            await ready("mutate_a");
            await ready("mutate_b");
            const handle = await widget("mutate_a")
              .locator("iframe")
              .elementHandle();
            assert(handle);
            const initialWindow = await handle.evaluateHandle((node) => {
              if (!(node instanceof HTMLIFrameElement))
                throw Error("Expected actual app iframe");
              return node.contentWindow;
            });
            const reads = meter.reads;
            await widget("mutate_a")
              .frameLocator("iframe")
              .getByRole("button", { name: "Navigate", exact: true })
              .click();
            const child = widget("mutate_a")
              .frameLocator("iframe")
              .locator("#result");
            await expect(child).toHaveAttribute("data-direct", "refused");
            await expect(child).toHaveAttribute("data-negotiated", "refused");
            await expect(child).toHaveAttribute("data-outcome", "refused");
            await expect(child).toHaveAttribute("data-origin", "null");
            await quiet();
            const currentFrame = await widget("mutate_a")
              .locator("iframe")
              .elementHandle();
            assert(currentFrame, "Current app iframe missing");
            result.replacement = {
              sameElement: await currentFrame.evaluate(
                (node, original) =>
                  node instanceof HTMLIFrameElement &&
                  node.isConnected &&
                  node === original,
                handle,
              ),
              sameWindow: await currentFrame.evaluate(
                (node, old) =>
                  node instanceof HTMLIFrameElement &&
                  node.contentWindow === old,
                initialWindow,
              ),
              opaque: (await child.getAttribute("data-origin")) === "null",
              outcome: await child.getAttribute("data-outcome"),
              direct: await child.getAttribute("data-direct"),
              negotiated: await child.getAttribute("data-negotiated"),
            };
            await currentFrame.dispose();
            assert(
              result.replacement.sameElement && result.replacement.sameWindow,
            );
            assert.equal(result.replacement.opaque, true);
            assert.equal(result.replacement.outcome, "refused");
            assert.equal(result.replacement.direct, "refused");
            assert.equal(result.replacement.negotiated, "refused");
            assert.equal(meter.reads, reads);
            assert(meter.replacements > 0);
            const remainingReads = meter.reads;
            await widget("mutate_b")
              .frameLocator("iframe")
              .getByRole("button", { name: "Read again", exact: true })
              .click();
            await expect.poll(() => meter.reads).toBe(remainingReads + 1);
            await ready("mutate_b");
            await initialWindow.dispose();
          },
        );
        await phase(
          "agent-opened remote App still requires this reader's Open",
          async () => {
            const before = snapshot(meter);
            await readerAgent("app_open", {
              room_id: roomId,
              connection_id: connection.id,
              tool: "mutate_a",
            });
            const open =
              variant === "svelte"
                ? page
                    .locator("[data-native-apps]")
                    .getByRole("button", { name: /^(Allow|Permitir)$/ })
                : page.locator("#connReaderOpen");
            await expect(open).toBeVisible();
            await quiet();
            assert.deepEqual(snapshot(meter), before);
            result.agentOpenRequiresReader = true;
          },
        );
        assert.deepEqual(result.pageErrors, []);
        assert.equal(meter.invalid, 0);
        assert.deepEqual(meter.initial, result.explicitGrants);
        assert.equal(
          result.browserRequests.call,
          Object.values(meter.initial).reduce((sum, count) => sum + count, 0) +
            meter.reads,
        );
        result.status = "passed";
      } catch (error) {
        result.status = "failed";
        result.failure = {
          name: error instanceof Error ? error.name : "UnknownError",
          phase: result.phase,
          sourceLocations:
            error instanceof Error
              ? [
                  ...new Set(
                    (error.stack ?? "").match(
                      /scripts\/(?:native-inline-app-open-browser|native-test-mcp)\.ts:\d+:\d+/g,
                    ) ?? [],
                  ),
                ].slice(0, 5)
              : [],
        };
      } finally {
        if (counters)
          result.snapshots.push({
            phase: "before-context-close",
            counters: snapshot(counters),
          });
        const cleanupFailed = () => {
          result.status = "failed";
          result.failure = { name: "ContextCleanupFailure", phase: "cleanup" };
        };
        await ownerContext?.close().catch(cleanupFailed);
        await authorContext?.close().catch(cleanupFailed);
        await writeFile(
          `${fixture.output}/inline-app-open.json`,
          JSON.stringify(evidence, null, 2) + "\n",
        );
      }
    }
    evidence.status = evidence.variants.every(
      (result) => result.status === "passed",
    )
      ? "passed"
      : "failed";
    return evidence;
  } catch (error) {
    evidence.status = "failed";
    evidence.failure = {
      name: error instanceof Error ? error.name : "UnknownError",
      phase: "fixture-startup-or-artifact",
    };
    return evidence;
  } finally {
    await server?.close().catch(() => {
      evidence.status = "failed";
      evidence.cleanupFailure = "server";
    });
    await writeFile(
      `${fixture.output}/inline-app-open.json`,
      JSON.stringify(evidence, null, 2) + "\n",
    );
  }
}
