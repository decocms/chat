// External OpenRouter-compatible model protocol only. Real canonical HTTP,
// Fire/Book/file review/storage/WebSocket and UI must never be intercepted.
import { createServer } from "node:http";
import * as z from "zod/mini";
import {
  FIRE_FIXTURE_MODEL,
  FIRE_HTML,
  FIRE_SPEECH,
  fireFixtureCard,
} from "./native-fire-fixture-data";

const Request = z.object({
  model: z.literal(FIRE_FIXTURE_MODEL),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user"]),
        content: z.union([
          z.string().check(z.maxLength(32_000)),
          z
            .array(
              z.strictObject({
                type: z.literal("text"),
                text: z.string().check(z.maxLength(32_000)),
              }),
            )
            .check(z.minLength(1), z.maxLength(1)),
        ]),
      }),
    )
    .check(z.minLength(2), z.maxLength(2)),
  temperature: z.number(),
  stream: z.optional(z.literal(false)),
  tools: z.optional(z.never()),
  tool_choice: z.optional(z.never()),
  response_format: z.optional(
    z.object({
      type: z.literal("json_schema"),
      json_schema: z.object({
        schema: z.object({
          type: z.literal("object"),
          properties: z.record(z.string(), z.unknown()),
          required: z.array(z.string()),
        }),
      }),
    }),
  ),
});
export function fireModelAnswer(input: unknown) {
  const result = Request.safeParse(input);
  if (!result.success) return null;
  const request = result.data;
  const [system, user] = request.messages;
  if (!system || !user || system.role !== "system" || user.role !== "user")
    return null;
  const systemText =
    typeof system.content === "string"
      ? system.content
      : system.content.map((part) => part.text).join("");
  const userText =
    typeof user.content === "string"
      ? user.content
      : user.content.map((part) => part.text).join("");
  const speech = userText.split("NEW SPEECH:\n").at(-1);
  if (!Object.values(FIRE_SPEECH).some((value) => value === speech))
    return null;
  const schema = request.response_format?.json_schema.schema;
  const keys = schema ? Object.keys(schema.properties).sort().join(",") : "";
  let content: string;
  let kind: "format" | "card" | "file";
  if (
    systemText.startsWith(
      "Choose the format for what a person is asking for, by voice.",
    ) &&
    request.temperature === 0 &&
    schema &&
    keys === "format" &&
    schema.required.join(",") === "format"
  ) {
    const format =
      speech === FIRE_SPEECH.html || speech === FIRE_SPEECH.htmlUpdate
        ? "html"
        : "card";
    content = JSON.stringify({ format });
    kind = "format";
  } else if (
    systemText.startsWith(
      "You build one native chat card live while a person talks:",
    ) &&
    request.temperature === 0.2 &&
    schema &&
    keys === "card,title" &&
    [...schema.required].sort().join(",") === "card,title"
  ) {
    const version =
      speech === FIRE_SPEECH.first
        ? 1
        : speech === FIRE_SPEECH.update
          ? 2
          : speech === FIRE_SPEECH.cardAgain
            ? 3
            : null;
    if (!version) return null;
    content = JSON.stringify({
      card: JSON.stringify(fireFixtureCard(version)),
      title: `Native Fire card ${version}`,
    });
    kind = "card";
  } else if (
    systemText.startsWith("You edit one file live while a person talks.") &&
    request.temperature === 0.2 &&
    !schema
  ) {
    if (speech !== FIRE_SPEECH.html && speech !== FIRE_SPEECH.htmlUpdate)
      return null;
    content = speech === FIRE_SPEECH.html ? FIRE_HTML.first : FIRE_HTML.second;
    kind = "file";
  } else return null;
  return {
    kind,
    body: {
      id: "synthetic-native-fire",
      model: FIRE_FIXTURE_MODEL,
      created: 1,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    },
  };
}
export async function startFireModelFixture() {
  const evidence = {
    scope:
      "Simulated external Fire model; actual SDK/HTTP/Book/R2/UI, not model intelligence or speech hardware",
    format: 0,
    card: 0,
    file: 0,
    invalid: 0,
    authorizationRejected: 0,
  };
  const server = createServer(async (request, response) => {
    const deadline = setTimeout(() => request.destroy(), 10_000);
    response.once("close", () => clearTimeout(deadline));
    const reject = (status: number) => {
      response.writeHead(status, { connection: "close" }).end(() => {
        if (!request.complete) request.destroy();
      });
    };
    if (
      request.method !== "POST" ||
      request.url !== "/api/v1/chat/completions"
    ) {
      evidence.invalid++;
      reject(404);
      return;
    }
    if (
      request.headers.authorization !== undefined ||
      request.headers.cookie !== undefined
    ) {
      evidence.authorizationRejected++;
      reject(400);
      return;
    }
    if (
      request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !==
      "application/json"
    ) {
      evidence.invalid++;
      reject(400);
      return;
    }
    try {
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of request) {
        const raw: unknown = chunk;
        if (!Buffer.isBuffer(raw) && typeof raw !== "string")
          throw Error("Invalid body");
        const value = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
        if ((bytes += value.byteLength) > 128 * 1024) throw Error("Body limit");
        chunks.push(value);
      }
      const raw: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const answer = fireModelAnswer(raw);
      if (!answer) {
        evidence.invalid++;
        reject(400);
        return;
      }
      evidence[answer.kind]++;
      response
        .writeHead(200, {
          "content-type": "application/json",
          "cache-control": "no-store",
        })
        .end(JSON.stringify(answer.body));
    } catch {
      evidence.invalid++;
      if (!response.destroyed) reject(400);
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw Error("Missing Fire fixture address");
  return {
    url: `http://127.0.0.1:${address.port}/api/v1/chat/completions`,
    evidence,
    async close() {
      server.closeAllConnections();
      if (server.listening)
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
    },
  };
}
