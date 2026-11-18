import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import {
  expect as baseExpect,
  type APIResponse,
  type BrowserContext,
} from "@playwright/test";
import {
  CreateRoomResult,
  CreateConnectionResult,
  MeResult,
  OkResult,
} from "../shared/schemas";
import { nativeTestAgent } from "./native-test-mcp";
import { localBrowserError } from "./native-browser-fixtures";
import type { NativeApplicationAuditFixture } from "./native-application-browser-types";
import {
  startDirectMcpFixture,
  type DirectMeter,
  type DirectVariant,
} from "./native-direct-mcp-fixture";
const expect = baseExpect.configure({ timeout: 30000 });
export async function auditDirectMcp(
  fixture: Pick<
    NativeApplicationAuditFixture,
    "base" | "ownerEmail" | "output" | "createProfile" | "step"
  >,
) {
  const evidence: {
    status: "running" | "passed" | "failed";
    variants: {
      variant: DirectVariant;
      status: "running" | "passed" | "failed";
      phase: string;
      counters?: DirectMeter;
      workerProxyRequests: number;
      browserToolPosts: number;
      readerGrant: boolean;
      pageErrors: ReturnType<typeof localBrowserError>[];
      failure?: string;
      cleanupFailure?: "archive" | "context";
    }[];
    sdk?: { version: string; sha256: string };
    failure?: string;
    cleanupFailure?: boolean;
    gaps: string[];
  } = {
    status: "running",
    variants: [],
    gaps: [
      "Controlled CORS MCP peer; no real third-party provider acceptance",
      "No credential removal or OAuth/token fallback changes; those remain separate existing gates",
      "No physical browser microphone or production traffic",
    ],
  };
  let server: Awaited<ReturnType<typeof startDirectMcpFixture>> | null = null;
  const failures: unknown[] = [];
  try {
    await mkdir(fixture.output, { recursive: true });
    server = await startDirectMcpFixture(fixture.base);
    evidence.sdk = server.sdk;
    for (const variant of ["svelte", "vanilla"] as const) {
      const result: (typeof evidence.variants)[number] = {
        variant,
        status: "running",
        phase: "profile",
        workerProxyRequests: 0,
        browserToolPosts: 0,
        readerGrant: false,
        pageErrors: [],
      };
      evidence.variants.push(result);
      let context: BrowserContext | null = null;
      let ownedRoom: string | null = null;
      try {
        const profile = await fixture.createProfile({
          lang: "en",
          theme: "light",
          width: 1440,
        });
        context = profile.context;
        // A vanilla user since Svelte became the default: this device chose vanilla.
        if (variant === "vanilla")
          await context.addCookies([
            { name: "vb_ui", value: "vanilla", url: fixture.base },
          ]);
        const page = profile.page;
        page.on("pageerror", (error) =>
          result.pageErrors.push(localBrowserError(error, fixture.base)),
        );
        const me = MeResult.parse(
          await (
            await context.request.get(fixture.base + "/api/me?ui=svelte")
          ).json(),
        );
        assert.equal(me.email, fixture.ownerEmail);
        result.phase = "create-real-room";
        const created = await context.request.post(
          fixture.base + "/api/books",
          {
            headers: { origin: fixture.base },
            data: { title: `Direct browser proof ${variant}` },
          },
        );
        assert(created.ok());
        const room = CreateRoomResult.parse(await created.json()).id;
        ownedRoom = room;
        const remote: { url: string; meter: DirectMeter } = server.configure(
          variant,
          room,
          me.email,
        );
        result.counters = remote.meter;
        const connected: APIResponse = await context.request.post(
          fixture.base + `/api/books/${room}/connections`,
          {
            headers: { origin: fixture.base },
            data: { url: remote.url, scope: "room" },
          },
        );
        assert(connected.ok());
        const connection = CreateConnectionResult.parse(
          await connected.json(),
        ).connection;
        assert(connection && !connection.needs_sign_in);
        // Seed a real cookie eligible for the external host; direct credential omission must keep it off the wire.
        await context.addCookies([
          {
            name: "direct_mcp_sentinel",
            value: "controlled-test-only",
            url: new URL(remote.url).origin + "/",
          },
        ]);
        const agent = await nativeTestAgent(page, fixture.base);
        page.on("request", (request) => {
          const url = new URL(request.url());
          if (
            url.origin === fixture.base &&
            url.pathname ===
              `/api/books/${room}/connections/${connection.id}/call`
          )
            result.workerProxyRequests++;
          if (request.method() === "POST" && request.url() === remote.url) {
            const raw = request.postData();
            if (!raw) return;
            try {
              const value: unknown = JSON.parse(raw);
              if (
                typeof value === "object" &&
                value !== null &&
                "method" in value &&
                value.method === "tools/call"
              )
                result.browserToolPosts++;
            } catch {
              /* Invalid envelopes cannot satisfy peer counters. */
            }
          }
        });
        result.phase = "real-room-ready";
        await page.goto(
          fixture.base +
            `/b/${room}${variant === "svelte" ? "?ui=svelte" : "?ui=vanilla"}`,
        );
        await expect(
          page.locator(variant === "svelte" ? "[data-room-chat]" : "#msgs"),
        ).toBeVisible();
        result.phase = "reader-approval";
        await agent("app_open", {
          room_id: room,
          connection_id: connection.id,
          tool: "direct_counter",
        });
        const allow =
          variant === "svelte"
            ? page.locator("[data-native-apps]").getByRole("button", {
                name: /^(Allow|Permitir)$/,
                exact: true,
              })
            : page.locator("#connReaderOpen");
        await expect(allow).toBeVisible();
        await page.waitForTimeout(600);
        assert.equal(remote.meter.initial, 0);
        assert.equal(remote.meter.failed, 0);
        assert.equal(remote.meter.resources, 0);
        assert.equal(remote.meter.sdk, 0);
        assert.equal(result.workerProxyRequests, 0);
        assert.equal(result.browserToolPosts, 0);
        await fixture.step(
          `direct-${variant}-reader-granted-call`,
          async () => {
            result.readerGrant = true;
            await allow.click();
            const frame = page.frameLocator(
              variant === "svelte"
                ? "[data-native-app-frame] iframe"
                : "iframe.connFrame",
            );
            await expect(frame.locator("#direct-result")).toHaveAttribute(
              "data-initial",
              "received",
            );
            await expect.poll(() => remote.meter.initial).toBe(1);
            assert.equal(result.browserToolPosts, 1);
            assert.equal(result.workerProxyRequests, 0);
            assert.equal(remote.meter.proxyTools, 0);
            assert(
              remote.meter.browserVerified >= 1,
              "Actual browser requests must carry verified identities",
            );
            assert.equal(remote.meter.cookieForwarded, 0);
            result.phase = "tool-failure-no-replay";
            await frame.locator("#fail").click();
            await expect(frame.locator("#direct-result")).toHaveAttribute(
              "data-failure",
              "refused",
            );
            await expect.poll(() => remote.meter.failed).toBe(1);
            // Negative observation only after positive SDK error completion, never a substitute for readiness.
            await page.waitForTimeout(800);
            assert.equal(remote.meter.initial, 1);
            assert.equal(remote.meter.failed, 1);
            assert.equal(result.browserToolPosts, 2);
            assert.equal(result.workerProxyRequests, 0);
            assert.equal(remote.meter.proxyTools, 0);
            assert.equal(remote.meter.cookieForwarded, 0);
            assert.equal(remote.meter.invalid, 0);
          },
        );
        assert.deepEqual(result.pageErrors, []);
        result.phase = "complete";
        result.status = "passed";
      } catch (error) {
        result.status = "failed";
        result.failure = error instanceof Error ? error.name : "UnknownError";
        failures.push(error);
      } finally {
        if (context && ownedRoom) {
          try {
            const archive = await context.request.post(
              `${fixture.base}/api/books/${ownedRoom}/archive`,
              {
                headers: { origin: fixture.base },
                data: { archived: true },
                timeout: 5000,
              },
            );
            assert(archive.ok());
            OkResult.parse(await archive.json());
          } catch (error) {
            result.status = "failed";
            result.cleanupFailure = "archive";
            failures.push(error);
          }
        }
        if (context)
          try {
            await context.close();
          } catch (error) {
            result.status = "failed";
            result.cleanupFailure = "context";
            failures.push(error);
          }
        await writeFile(
          fixture.output + "/direct-mcp.json",
          JSON.stringify(evidence, null, 2) + "\n",
        );
      }
    }
    if (failures.length)
      throw new AggregateError(failures, "Direct MCP browser audit failed");
    evidence.status = "passed";
  } catch (error) {
    evidence.status = "failed";
    evidence.failure = error instanceof Error ? error.name : "UnknownError";
    throw error;
  } finally {
    try {
      await server?.stop();
    } catch (error) {
      evidence.status = "failed";
      evidence.cleanupFailure = true;
      throw error;
    } finally {
      await mkdir(fixture.output, { recursive: true });
      await writeFile(
        fixture.output + "/direct-mcp.json",
        JSON.stringify(evidence, null, 2) + "\n",
      );
    }
  }
  return evidence;
}
