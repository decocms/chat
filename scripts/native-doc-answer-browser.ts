// Real Worker/Book/D1/R2/MCP and browser UI. No canonical/API/WS response mocks.
import { receivedEvent, sentFrame } from "./room-frames";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import {
  expect as baseExpect,
  type APIResponse,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import * as z from "zod/mini";
import { CreateRoomResult, MeResult, OkResult } from "../shared/schemas";
import { nativeTestAgent } from "./native-test-mcp";
import { localBrowserError } from "./native-browser-fixtures";
import { appProbeDocument } from "./native-app-probe-documents";
import type { NativeApplicationAuditFixture } from "./native-application-browser-types";

const expect = baseExpect.configure({ timeout: 30_000 });
const opened = z.object({
  ok: z.literal(true),
  opened_in_tabs: z.number().check(z.minimum(0)),
});
const refused = z.object({ ok: z.literal(false), error: z.string() });
const read = z.object({ messages: z.array(z.object({ id: z.number() })) });
const uploaded = z.object({
  ok: z.literal(true),
  file: z.object({
    id: z.string().check(z.regex(/^[a-f0-9]{8,64}$/)),
    name: z.string(),
    type: z.literal("text/html"),
    size: z.number(),
  }),
});
type Result = {
  status: "running" | "passed" | "failed";
  phase: string;
  roomId?: string;
  epicId?: string;
  ownTabs?: number;
  openDocEvents: number;
  refusals: number;
  cardVersions: number;
  readonlyMessagesBefore?: number;
  readonlyMessagesAfter?: number;
  browserMessageCommands: number;
  uploads: {
    id: string;
    htmlSHA256: string;
    rawR2Verified: boolean;
    privateRead: boolean;
    docPaneRetained: boolean;
  }[];
  pageErrors: ReturnType<typeof localBrowserError>[];
  failure?: { phase: string; code: "audit-failed" };
  cleanupFailure?: "archive" | "context";
};
type Evidence = {
  status: "running" | "passed" | "failed";
  result: Result;
  gaps: string[];
};
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const preview = (page: Page) => page.locator("[data-document-preview]");
const header = (page: Page) => page.locator("[data-native-room-header]");
async function documentVisible(page: Page) {
  await expect(page.locator("[data-native-document]")).toBeVisible();
  await expect(preview(page)).toBeVisible();
}
async function quietWindow(page: Page) {
  await page.waitForTimeout(600);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
function cardDocument(version: number) {
  const spec = {
    root: "root",
    elements: {
      root: {
        type: "Card",
        props: { title: `Controlled document card ${version}` },
        children: ["text", "fields", "actions"],
      },
      text: {
        type: "Text",
        props: { content: "Literal <img src=x onerror=evil()>" },
      },
      fields: { type: "Fields", children: ["value"] },
      value: {
        type: "Field",
        props: { label: "Canonical value", value: String(41 + version) },
      },
      actions: { type: "Actions", children: ["answer"] },
      answer: {
        type: "Button",
        props: { label: "Confirm synthetic answer", value: "must-not-post" },
      },
    },
  };
  return (
    "# Controlled live answer\n\n```card\n" +
    JSON.stringify(spec) +
    '\n```\n\n```card\n{invalid:"<img src=x onerror=evil()>"}\n```\n'
  );
}

export async function auditDocumentAnswers(
  fixture: Pick<
    NativeApplicationAuditFixture,
    "base" | "ownerEmail" | "output" | "createProfile" | "step"
  >,
): Promise<Evidence> {
  assert(/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(fixture.base));
  assert(fixture.ownerEmail.endsWith("@example.test"));
  const result: Result = {
    status: "running",
    phase: "profile",
    openDocEvents: 0,
    refusals: 0,
    cardVersions: 0,
    browserMessageCommands: 0,
    uploads: [],
    pageErrors: [],
  };
  const evidence: Evidence = {
    status: "running",
    result,
    gaps: [
      "Actual disposable local Worker/Auth DCR+PKCE/Book/D1/R2/MCP/UI paths; DEV identity does not verify email issuance or production OAuth.",
      "Room App HTML is the existing exact allowlisted read-probe document, with two different inactive loopback navigation destinations; external model judgments are simulated, not provider intelligence acceptance.",
      "The child read probe uses the real JSON-RPC/private document channel; separate existing audits cover stock child SDK compatibility and replacement-document denial.",
      "Two same-person tabs prove real recipient delivery; other-person/revoked-member dispatch is covered by backend authority fixtures, not claimed here.",
      "Refusal/no-write observations use a bounded 600ms and two-frame interval after positive readiness, not an unbounded absence claim.",
      "Desktop Chromium only. Hardware dictation, positive Whisper provider, Safari/iOS, deployment and performance acceptance remain separate.",
    ],
  };
  await mkdir(fixture.output, { recursive: true });
  try {
    let context: BrowserContext | null = null;
    try {
      const profile = await fixture.createProfile({
        lang: "en",
        theme: "light",
        width: 1440,
      });
      context = profile.context;
      const page = profile.page;
      const watchErrors = (owned: Page) =>
        owned.on("pageerror", (error) =>
          result.pageErrors.push(localBrowserError(error, fixture.base)),
        );
      watchErrors(page);
      const me = MeResult.parse(
        await (await context.request.get(`${fixture.base}/api/me`)).json(),
      );
      assert.equal(me.email, fixture.ownerEmail);
      result.phase = "real-dcr-pkce";
      const agent = await nativeTestAgent(page, fixture.base);
      result.phase = "create-disposable-room";
      const created = await context.request.post(`${fixture.base}/api/books`, {
        headers: { origin: fixture.base },
        data: { title: "Document answer" },
      });
      assert(created.ok());
      const roomId = CreateRoomResult.parse(await created.json()).id;
      result.roomId = roomId;
      const epicTitle = "Controlled document epic";
      const epic = z.object({ epic_id: z.string() }).parse(
        await agent("start_epic", {
          room_id: roomId,
          title: epicTitle,
          why: "Disposable document-answer verification",
          tasks: ["Keep the answer open"],
          backlog: true,
        }),
      ).epic_id;
      result.epicId = epic;
      const roomText = "Controlled room document marker",
        epicText = "Controlled epic document marker";
      OkResult.parse(
        await agent("update_doc", { room_id: roomId, markdown: roomText }),
      );
      OkResult.parse(
        await agent("update_doc", {
          room_id: roomId,
          epic_id: epic,
          markdown: epicText,
        }),
      );
      await context.addInitScript(() => {
        if (window.top !== window) return;
        localStorage.setItem("vb.docView", "preview");
      });
      const watchWire = (owned: Page) =>
        owned.on("websocket", (socket) => {
          if (new URL(socket.url()).pathname !== `/ws/${roomId}`) return;
          socket.on("framereceived", (frame) => {
            if (receivedEvent(frame.payload)?.t === "openDoc")
              result.openDocEvents++;
          });
          socket.on("framesent", (frame) => {
            if (sentFrame(frame.payload)?.t === "msg")
              result.browserMessageCommands++;
          });
        });
      watchWire(page);
      const second = await context.newPage();
      watchErrors(second);
      watchWire(second);
      const roomUrl = `${fixture.base}/b/${roomId}`;
      for (const tab of [page, second]) {
        await tab.goto(roomUrl);
        await expect(header(tab)).toBeVisible();
        await expect(
          tab.locator(`[data-epic-thread="${epic}"]`).first(),
        ).toBeAttached();
      }
      result.phase = "open-exact-epic-in-own-tabs";
      await fixture.step("document-answer-open-doc", async () => {
        const openedEpic = opened.parse(
          await agent("open_doc", { room_id: roomId, epic_id: epic }),
        );
        assert(openedEpic.opened_in_tabs >= 2);
        result.ownTabs = openedEpic.opened_in_tabs;
        for (const tab of [page, second]) {
          await documentVisible(tab);
          await expect(preview(tab)).toContainText(epicText);
          await expect(header(tab)).toContainText(epicTitle);
          assert.equal(new URL(tab.url()).searchParams.get("t"), epic);
        }
        opened.parse(await agent("open_doc", { room_id: roomId }));
        for (const tab of [page, second]) {
          await expect(preview(tab)).toContainText(roomText);
          await expect(header(tab)).toContainText(epicTitle);
        }
      });
      await expect.poll(() => result.openDocEvents).toBeGreaterThanOrEqual(4);
      result.phase = "unknown-and-deleted-target-refusal";
      const unused = z.object({ epic_id: z.string() }).parse(
        await agent("start_epic", {
          room_id: roomId,
          title: "Disposable deleted target",
          why: "Refusal control",
          tasks: [],
          backlog: true,
        }),
      ).epic_id;
      OkResult.parse(
        await agent("delete_epic", { room_id: roomId, epic_id: unused }),
      );
      const beforeRefusal = result.openDocEvents;
      for (const target of ["000000000000", unused]) {
        refused.parse(
          await agent(
            "open_doc",
            { room_id: roomId, epic_id: target },
            "refusal",
          ),
        );
        result.refusals++;
      }
      await quietWindow(page);
      assert.equal(result.openDocEvents, beforeRefusal);
      for (const tab of [page, second]) {
        await expect(preview(tab)).toContainText(roomText);
        await expect(header(tab)).toContainText(epicTitle);
      }
      await second.close();
      result.phase = "return-from-room-doc-to-same-epic";
      opened.parse(await agent("open_doc", { room_id: roomId, epic_id: epic }));
      await expect(preview(page)).toContainText(epicText);
      for (const version of [1, 2]) {
        result.phase = `live-readonly-card-${version}`;
        OkResult.parse(
          await agent("update_doc", {
            room_id: roomId,
            epic_id: epic,
            markdown: cardDocument(version),
          }),
        );
        await documentVisible(page);
        const card = preview(page).locator("[data-native-card-readonly]");
        await expect(card).toHaveCount(1);
        await expect(card).toContainText(`Controlled document card ${version}`);
        await expect(card).toContainText(String(41 + version));
        await expect(card).toContainText("Literal <img src=x onerror=evil()>");
        await expect(preview(page).locator("pre code")).toContainText(
          '{invalid:"<img src=x onerror=evil()>"}',
        );
        await expect(
          preview(page).locator(
            "img,script,[data-native-card-answer],[data-cardbtn]",
          ),
        ).toHaveCount(0);
        if (version === 2)
          await expect(card).not.toContainText("Controlled document card 1");
        result.cardVersions++;
      }
      result.phase = "readonly-no-message-mutation";
      const before = read
        .parse(await agent("read_room", { room_id: roomId, all: true }))
        .messages.map((message) => message.id);
      result.readonlyMessagesBefore = before.length;
      const sentBefore = result.browserMessageCommands;
      await preview(page)
        .getByText("Confirm synthetic answer", { exact: true })
        .click();
      await quietWindow(page);
      const after = read
        .parse(await agent("read_room", { room_id: roomId, all: true }))
        .messages.map((message) => message.id);
      result.readonlyMessagesAfter = after.length;
      assert.deepEqual(after, before);
      assert.equal(result.browserMessageCommands, sentBefore);
      result.phase = "embedded-html-r2-live-version";
      const appName = "doc-answer",
        filename = `apps/${appName}.html`;
      OkResult.parse(
        await agent("update_doc", {
          room_id: roomId,
          epic_id: epic,
          markdown: `# Controlled embedded answer\n\n[[app:room/${appName}|m]]\n`,
        }),
      );
      await expect(preview(page)).toContainText("Controlled embedded answer");
      const port = Number(new URL(fixture.base).port);
      for (const version of [1, 2]) {
        result.phase = `embedded-html-upload-${version}`;
        const destinationPort = ((port + version - 1) % 65535) + 1;
        const html = appProbeDocument(
          "initial",
          fixture.base,
          `http://127.0.0.1:${destinationPort}/replacement`,
        );
        const marker = `Controlled uploaded version ${version}`;
        const stored = uploaded.parse(
          await agent("upload_file", {
            room_id: roomId,
            filename,
            content_type: "text/html",
            text: html,
            message: marker,
            thread: "main",
          }),
        );
        assert.equal(stored.file.name, filename);
        if (version === 2)
          assert.notEqual(stored.file.id, result.uploads[0].id);
        const record = {
          id: stored.file.id,
          htmlSHA256: hash(html),
          rawR2Verified: false,
          privateRead: false,
          docPaneRetained: false,
        };
        result.uploads.push(record);
        result.phase = `embedded-html-r2-${version}`;
        const raw: APIResponse = await context.request.get(
          `${fixture.base}/api/books/${roomId}/files/${stored.file.id}`,
        );
        assert(raw.ok());
        assert.equal(hash(await raw.text()), record.htmlSHA256);
        record.rawR2Verified = true;
        result.phase = `embedded-html-private-read-${version}`;
        await documentVisible(page);
        const frame = preview(page).frameLocator("[data-document-app] iframe");
        await expect(frame.locator("#stage")).toHaveText("initial");
        await expect(frame.locator("#result")).toHaveAttribute(
          "data-outcome",
          "read",
        );
        await expect(frame.locator("#result")).toHaveText(marker);
        record.privateRead = true;
        result.phase = `embedded-html-doc-pane-${version}`;
        await quietWindow(page);
        await documentVisible(page);
        record.docPaneRetained = true;
      }
      assert.equal(result.uploads.length, 2);
      assert.deepEqual(result.pageErrors, []);
      result.phase = "complete";
      result.status = "passed";
    } catch {
      result.status = "failed";
      result.failure = { phase: result.phase, code: "audit-failed" };
    } finally {
      if (context && result.roomId) {
        try {
          const archive = await context.request.post(
            `${fixture.base}/api/books/${result.roomId}/archive`,
            {
              headers: { origin: fixture.base },
              data: { archived: true },
              timeout: 5000,
            },
          );
          assert(archive.ok());
          OkResult.parse(await archive.json());
        } catch {
          result.cleanupFailure = "archive";
          result.status = "failed";
        }
      }
      if (context)
        try {
          await context.close();
        } catch {
          result.cleanupFailure = "context";
          result.status = "failed";
        }
    }
    if (result.pageErrors.length) {
      result.status = "failed";
      result.failure ??= { phase: result.phase, code: "audit-failed" };
    }
    evidence.status = result.status === "passed" ? "passed" : "failed";
    return evidence;
  } finally {
    if (evidence.status === "running") evidence.status = "failed";
    await writeFile(
      `${fixture.output}/native-document-answers.json`,
      JSON.stringify(evidence, null, 2) + "\n",
    );
  }
}
