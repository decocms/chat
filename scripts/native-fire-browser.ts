// Actual Worker/SDK/Book/R2/WS/UI audit. Only the browser speech capability and
// external model judgment are synthetic; no canonical route is intercepted.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, type BrowserContext } from "@playwright/test";
import { get } from "svelte/store";
import { CreateRoomResult, FireResult } from "../shared/schemas";
import { parseRoomEvent, record } from "../shared/validation";
import { createRoomStore } from "../svelte/roomStore";
import type { NativeApplicationAuditFixture } from "./native-application-browser-types";
import { FIRE_HTML, FIRE_SPEECH } from "./native-fire-fixture-data";

interface SpeechFixture {
  starts: number;
  active(): boolean;
  emit(text: string): void;
  late(text: string): void;
}
declare global {
  interface Window {
    __nativeFireFixture?: SpeechFixture;
  }
}

export async function auditNativeFire(fixture: NativeApplicationAuditFixture) {
  let ownedContext: BrowserContext | null = null;
  const evidence = {
    status: "running",
    scope:
      "Real Worker HTTP/SDK/Book/R2/WebSocket/UI; synthetic owned-context SpeechRecognition and external model, not speech hardware or provider intelligence",
    phases: [] as { name: string; status: "running" | "passed" | "failed" }[],
    canonicalFirePieces: 0,
    reviewMessages: 0,
    reviewCommands: 0,
    reviewCommandResults: 0,
    cardUpdates: 0,
    fileVersions: 0,
    failurePhase: null as string | null,
  };
  const phase = async (name: string, run: () => Promise<void>) => {
    const row: (typeof evidence.phases)[number] = { name, status: "running" };
    evidence.phases.push(row);
    try {
      await run();
      row.status = "passed";
    } catch (error) {
      row.status = "failed";
      evidence.failurePhase = name;
      throw error;
    }
  };
  try {
    const { context, page } = await fixture.createProfile({
      lang: "en",
      theme: "light",
      width: 1440,
    });
    ownedContext = context;
    assert(/^http:\/\/127\.0\.0\.1:[1-9]\d*$/.test(fixture.base));
    const created = await context.request.post(`${fixture.base}/api/books`, {
      headers: { origin: fixture.base },
      data: { title: "Native Fire owned protocol fixture" },
    });
    assert(created.ok());
    const room = CreateRoomResult.parse(await created.json()).id;
    const store = createRoomStore();
    const invalidFrames: string[] = [];
    const reviewCommands = new Set<string>();
    page.on("websocket", (socket) => {
      if (new URL(socket.url()).pathname !== `/ws/${room}`) return;
      socket.on("framesent", ({ payload }) => {
        try {
          const command: unknown = JSON.parse(payload.toString());
          if (
            record(command) &&
            command.t === "msg" &&
            typeof command.text === "string" &&
            command.text.startsWith("🔥 Fire mode:") &&
            typeof command.cid === "string"
          ) {
            reviewCommands.add(command.cid);
            evidence.reviewCommands++;
          }
        } catch {
          invalidFrames.push("InvalidOutgoingBookCommand");
        }
      });
      socket.on("framereceived", ({ payload }) => {
        try {
          const event = parseRoomEvent(payload.toString());
          if (event.t === "result" && reviewCommands.has(event.cid) && event.ok)
            evidence.reviewCommandResults++;
          store.apply(event, room);
        } catch {
          invalidFrames.push("InvalidRealBookFrame");
        }
      });
    });
    await context.addInitScript(
      ({ base, room }) => {
        if (
          window !== window.top ||
          location.origin !== base ||
          location.pathname !== `/b/${room}`
        )
          return;
        let current: SyntheticRecognition | null = null;
        let saved: ((event: unknown) => void) | null = null;
        const event = (texts: string[]) => ({
          resultIndex: texts.length - 1,
          results: texts.map((text) => ({
            0: { transcript: text },
            isFinal: true,
          })),
        });
        class SyntheticRecognition {
          lang = "";
          continuous = false;
          interimResults = false;
          onresult: ((event: unknown) => void) | null = null;
          onerror: ((event: unknown) => void) | null = null;
          onend: ((event: unknown) => void) | null = null;
          live = false;
          texts: string[] = [];
          start() {
            this.live = true;
            current = this;
            controls.starts++;
          }
          stop() {
            this.live = false;
            this.onend?.({});
          }
          abort() {
            this.live = false;
            this.onend?.({});
          }
        }
        const controls: SpeechFixture = {
          starts: 0,
          active: () => !!current?.live,
          emit(text) {
            if (!current?.live || !current.onresult)
              throw Error("No owned recognizer");
            current.texts.push(text);
            saved = current.onresult;
            current.onresult(event(current.texts));
          },
          late(text) {
            saved?.(event([text]));
          },
        };
        Object.defineProperty(window, "SpeechRecognition", {
          value: SyntheticRecognition,
          configurable: true,
        });
        window.__nativeFireFixture = controls;
      },
      { base: fixture.base, room },
    );
    await page.goto(`${fixture.base}/b/${room}?ui=svelte`);
    const composer = page.locator("[data-native-composer]"),
      input = composer.locator("#input"),
      mic = composer.getByRole("button", {
        name: "Dictate message",
        exact: true,
      });
    await expect(input).toBeVisible();
    await expect.poll(() => get(store.state)?.id).toBe(room);
    const emit = (text: string) =>
      page.evaluate((text) => {
        if (!window.__nativeFireFixture)
          throw Error("Missing owned speech fixture");
        window.__nativeFireFixture.emit(text);
      }, text);
    const canonical = () => get(store.state)?.messages ?? [];
    const fireResponse = () =>
      page.waitForResponse(
        (response) =>
          response.url() === `${fixture.base}/api/books/${room}/fire` &&
          response.request().method() === "POST",
        { timeout: 60_000 },
      );
    await phase(
      "tap dictation toggles and Send rejects late speech",
      async () => {
        await mic.click();
        await expect
          .poll(() => page.evaluate(() => window.__nativeFireFixture?.active()))
          .toBe(true);
        await mic.click();
        await expect
          .poll(() => page.evaluate(() => window.__nativeFireFixture?.active()))
          .toBe(false);
        await mic.click();
        await emit("Native Fire dictation sent once.");
        await expect(input).toHaveValue("Native Fire dictation sent once.");
        await composer.locator("[data-composer-send]").click();
        await expect
          .poll(
            () =>
              canonical().filter(
                (message) =>
                  message.text === "Native Fire dictation sent once.",
              ).length,
          )
          .toBe(1);
        await expect(input).toHaveValue("");
        await page.evaluate(() =>
          window.__nativeFireFixture?.late("LATE SPEECH MUST NOT RESTORE"),
        );
        await expect(input).toHaveValue("");
        assert.equal(
          canonical().filter(
            (message) => message.text === "Native Fire dictation sent once.",
          ).length,
          1,
        );
      },
    );
    const hold = async () => {
      const box = await mic.boundingBox();
      assert(box);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      try {
        await expect(
          composer.getByRole("progressbar", { name: "Fire mode", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("dialog", { name: "Fire mode", exact: true }),
        ).toBeVisible({ timeout: 10_000 });
      } finally {
        await page.mouse.up();
      }
    };
    await phase(
      "physical hold charges then first-use consent starts Fire",
      async () => {
        await hold();
        await page
          .getByRole("dialog", { name: "Fire mode", exact: true })
          .getByRole("button", { name: "Light the fire", exact: true })
          .click();
        await expect(composer.locator("[data-native-fire-bar]")).toContainText(
          "live: speak",
        );
      },
    );
    const apply = async (text: string) => {
      const pending = fireResponse();
      await emit(text);
      const response = await pending;
      assert.equal(response.status(), 200);
      const result = FireResult.parse(await response.json());
      assert(result.ok);
      await expect(
        composer.locator("[data-native-fire-bar]"),
      ).not.toContainText("applying:");
      return result;
    };
    let card = 0,
      firstFile = "",
      latestFile = "";
    await phase(
      "real SDK card create and msgCard update render natively",
      async () => {
        const first = await apply(FIRE_SPEECH.first);
        assert(first.mode === "card");
        card = first.card_msg;
        await expect(page.locator(`#m${card}`)).toContainText(
          "Native Fire card 1",
        );
        const second = await apply(FIRE_SPEECH.update);
        assert(second.mode === "card");
        assert.equal(second.card_msg, card);
        await expect(page.locator(`#m${card}`)).toContainText(
          "Native Fire card 2",
        );
        evidence.cardUpdates++;
      },
    );
    await phase(
      "card switches to reviewed real R2 HTML and follows exact same-name version",
      async () => {
        const first = await apply(FIRE_SPEECH.html);
        assert(first.mode === "file");
        firstFile = first.file.id;
        await expect(page.locator("[data-side-file]")).toHaveAttribute(
          "data-file-id",
          first.file.id,
        );
        await expect
          .poll(() => {
            const file = get(store.state)?.files.find(
              (file) => file.id === first.file.id,
            );
            return file
              ? {
                  id: file.id,
                  name: file.name,
                  type: file.type,
                  size: file.size,
                  ts: file.ts,
                }
              : null;
          })
          .toEqual(first.file);
        const rawFirst = await context.request.get(
          `${fixture.base}/api/books/${room}/files/${first.file.id}`,
        );
        assert.equal(rawFirst.status(), 200);
        assert.equal(await rawFirst.text(), FIRE_HTML.first);
        const second = await apply(FIRE_SPEECH.htmlUpdate);
        assert(second.mode === "file");
        latestFile = second.file.id;
        assert.notEqual(second.file.id, first.file.id);
        assert.equal(second.file.name, first.file.name);
        await expect(page.locator("[data-side-file]")).toHaveAttribute(
          "data-file-id",
          second.file.id,
        );
        await expect
          .poll(
            () =>
              get(store.state)?.files.filter(
                (file) => file.name === first.file.name,
              ).length,
          )
          .toBe(2);
        const rawSecond = await context.request.get(
          `${fixture.base}/api/books/${room}/files/${second.file.id}`,
        );
        assert.equal(rawSecond.status(), 200);
        assert.equal(await rawSecond.text(), FIRE_HTML.second);
        evidence.fileVersions = 2;
      },
    );
    await phase(
      "Stop posts one actual ACK/canonical file review and hides canonical Fire pieces",
      async () => {
        await composer
          .locator("[data-native-fire-bar]")
          .getByRole("button", { name: "Stop", exact: true })
          .click();
        await expect(composer.locator("[data-native-fire-bar]")).toHaveCount(
          0,
          { timeout: 30_000 },
        );
        const reviews = () =>
          canonical().filter(
            (message) =>
              message.tag !== "fire" &&
              message.text?.startsWith("🔥 Fire mode:"),
          );
        await expect.poll(() => reviews().length).toBe(1);
        assert.deepEqual(
          reviews()[0]?.files?.map((file) => file.id),
          [latestFile],
        );
        const pieces = canonical().filter((message) => message.tag === "fire");
        assert.equal(pieces.length, 4);
        for (const piece of pieces)
          await expect(page.locator(`#m${piece.id}`)).toHaveCount(0);
        assert.equal(evidence.reviewCommands, 1);
        assert.equal(evidence.reviewCommandResults, 1);
        evidence.reviewMessages = 1;
        evidence.canonicalFirePieces = pieces.length;
      },
    );
    await phase(
      "new real Fire session changes open HTML back to card and reviews exact card",
      async () => {
        await composer.locator("[data-composer-more]").click();
        await composer
          .getByRole("menuitem", { name: "Fire mode", exact: true })
          .click();
        await expect(
          page.getByRole("dialog", { name: "Fire mode", exact: true }),
        ).toHaveCount(0);
        const next = await apply(FIRE_SPEECH.cardAgain);
        assert(next.mode === "card");
        assert.notEqual(next.card_msg, card);
        await expect(page.locator(`#m${next.card_msg}`)).toContainText(
          "Native Fire card 3",
        );
        await composer
          .locator("[data-native-fire-bar]")
          .getByRole("button", { name: "Stop", exact: true })
          .click();
        await expect(composer.locator("[data-native-fire-bar]")).toHaveCount(
          0,
          { timeout: 30_000 },
        );
        const reviews = canonical().filter(
          (message) =>
            message.tag !== "fire" && message.text?.startsWith("🔥 Fire mode:"),
        );
        assert.equal(reviews.length, 2);
        assert.equal(reviews[1]?.reply_to, next.card_msg);
        assert.equal(
          canonical().filter((message) => message.tag === "fire").length,
          5,
        );
        for (const piece of canonical().filter(
          (message) => message.tag === "fire",
        ))
          await expect(page.locator(`#m${piece.id}`)).toHaveCount(0);
        assert.equal(evidence.reviewCommands, 2);
        assert.equal(evidence.reviewCommandResults, 2);
        evidence.reviewMessages = 2;
        evidence.canonicalFirePieces = 5;
        assert(firstFile && latestFile);
        assert.deepEqual(invalidFrames, []);
      },
    );
    evidence.status = "passed";
    return evidence;
  } catch (error) {
    evidence.status = "failed";
    evidence.failurePhase ??= "profile/room setup";
    throw error;
  } finally {
    try {
      await ownedContext?.close();
    } catch (error) {
      evidence.status = "failed";
      evidence.failurePhase ??= "owned context cleanup";
      throw error;
    } finally {
      await writeFile(
        resolve(fixture.output, "native-fire.json"),
        JSON.stringify(evidence, null, 2),
      );
    }
  }
}
