// Stored message and actual Book method fixtures, including bounded SQLite-backed D1 reads; no real DO scheduling.
import { expect, mock, test } from "bun:test";
import { MessageSchema } from "../shared/room";
import {
  storedAttachments,
  storedMessageRows,
  storedChoices,
  storedCard,
  storedQuote,
  storedFileRefs,
  AccessRequested,
  agentMessageFromWire,
} from "../src/bookMessages";
import { cachedTools } from "../src/mcpTools";
import type { bookStub } from "../src/rooms";
import { sendTo } from "./book-test-wire";
type RemoteAgentRead = Awaited<
  ReturnType<ReturnType<typeof bookStub>["agentRead"]>
>;
type Assert<T extends true> = T;
// Compile the REAL Durable Object RPC serializer result, not Book's local
// method alone. Unknown extension values previously collapsed it to never.
type AgentReadRemainsSerializable = Assert<
  [RemoteAgentRead] extends [never]
    ? false
    : RemoteAgentRead extends { last_id: number }
      ? true
      : false
>;
const remoteLastId = (value: RemoteAgentRead): number => value.last_id;
type AgentChoiceWireRemainsFlat = Assert<
  RemoteAgentRead["messages"][number]["choices_wire"] extends string | undefined
    ? true
    : false
>;
mock.module("cloudflare:workers", () => ({
  DurableObject: class {},
  WorkerEntrypoint: class {},
  env: {},
}));
const { Book } = await import("../src/book");
const file = {
  id: "file-one",
  name: "report.txt",
  type: "text/plain",
  size: 4,
  author: "uploader@example.test",
  ts: 12,
};
const row = {
  id: 1,
  thread: "main",
  author: "member@example.test",
  text: "Kept text",
  ts: 100,
  files: null,
  choices: null,
  card: null,
};
const card = {
  root: "root",
  elements: {
    root: { type: "Card", props: { title: "Allowed" }, children: ["text"] },
    text: {
      type: "Text",
      props: { text: "Historical alias", style: "plain" },
      children: [],
    },
  },
};
const issues: string[] = [];
const issue = (kind: string) => issues.push(kind);
test("valid wire choices/card bytes and nullable older text/optional fields survive message projection", () => {
  const choices =
      ' {"options":["Yes","No"],"multi":null,"closed":"terminal","legacy":{"kept":true}} ',
    rawCard = JSON.stringify(card);
  const values = storedMessageRows(
    [
      {
        ...row,
        text: null,
        files: JSON.stringify([file]),
        choices,
        card: rawCard,
      },
    ],
    "abcdef",
  );
  expect(values).toHaveLength(1);
  expect(values[0].text).toBe("");
  expect(values[0].choices).toBe(choices);
  expect(values[0].card).toBe(rawCard);
  expect(values[0].files).toEqual([file]);
  expect(MessageSchema.safeParse(values[0]).success).toBe(true);
  expect(storedChoices(choices)?.closed).toBe("terminal");
  expect(storedChoices(choices)?.legacy).toEqual({ kept: true });
  expect(storedCard(rawCard, "abcdef")?.elements.text.props).toMatchObject({
    content: "Historical alias",
  });
});
test("choice extensions retain nested JSON-safe values without changing the original canonical wire", () => {
  const raw = JSON.stringify({
    options: ["Yes", "No"],
    extension: { nested: [null, true, 7, "kept", { deep: "value" }] },
  });
  expect(storedChoices(raw)?.extension).toEqual({
    nested: [null, true, 7, "kept", { deep: "value" }],
  });
  expect(
    storedMessageRows([{ ...row, choices: raw }], "abcdef")[0].choices,
  ).toBe(raw);
  const publicMessage = agentMessageFromWire({
    id: 1,
    text: "kept",
    choices_wire: raw,
  });
  expect(publicMessage).toMatchObject({
    id: 1,
    text: "kept",
    choices: {
      options: ["Yes", "No"],
      extension: { nested: [null, true, 7, "kept", { deep: "value" }] },
    },
  });
  expect(Object.hasOwn(publicMessage, "choices_wire")).toBe(false);
});
test("corrupt optional payloads do not discard valid text or neighboring messages; identity is never coerced", () => {
  const values = storedMessageRows(
    [
      {
        ...row,
        files: '[{"id":{}}]',
        choices: '{"options":[{}]}',
        card: '{"bad":true}',
      },
      { ...row, id: 2 },
      { ...row, id: "3" },
      { ...row, id: 4, kind: {} },
      { ...row, id: 5, reply_to: {} },
      { ...row, id: 6, ts: 1e100 },
    ],
    "abcdef",
    undefined,
    issue,
  );
  expect(values.map((value) => value.id)).toEqual([1, 2]);
  expect(values[0]).toMatchObject({
    text: row.text,
    files: [],
    choices: null,
    card: null,
  });
  expect(issues).toContain("message-row");
  expect(issues).toContain("card");
  const large = "x".repeat(1_000_001);
  expect(storedMessageRows([{ ...row, card: large }], "abcdef")[0].card).toBe(
    large,
  );
  expect(storedCard(large, "abcdef")).toBeNull();
});
test("older partial attachments recover only from the exact canonical file ID and preserve embedded/version fields", () => {
  const requested: string[] = [];
  const result = storedAttachments(
    JSON.stringify([
      {
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        embed: true,
      },
      { ...file, id: "wrong", author: null, ts: null },
      { ...file, size: {} },
    ]),
    (id) => {
      requested.push(id);
      return id === file.id ? file : undefined;
    },
    issue,
  );
  expect(result).toEqual([{ ...file, embed: true }]);
  expect(requested).toEqual([file.id, "wrong", file.id]);
  expect(storedAttachments(JSON.stringify([{ ...file, embed: null }]))).toEqual(
    [file],
  );
});
test("quote/search refs accept older minimal metadata and corrupt siblings cannot reach name logic", () => {
  const raw =
    '[{"id":"old","name":"old.txt"},{"id":"bad","name":{}},{"id":"next","name":"next.txt"}]';
  expect(storedFileRefs(raw, issue)).toEqual([
    { id: "old", name: "old.txt" },
    { id: "next", name: "next.txt" },
  ]);
  expect(
    storedQuote({ id: 1, author: row.author, text: null, files: raw }, issue),
  ).toMatchObject({ id: 1, text: "", files: ["old.txt", "next.txt"] });
  expect(
    storedQuote({ id: 2, author: {}, text: "must not spoof author" }, issue),
  ).toBeNull();
});
test("cached MCP tool contract preserves supported nested/legacy metadata and rejects malformed tools", () => {
  const tools = cachedTools(
    JSON.stringify([
      {
        name: "valid",
        title: "Title",
        annotations: { readOnlyHint: true, custom: "kept" },
        _meta: {
          ui: {
            resourceUri: "ui://nested",
            visibility: ["app"],
            custom: "kept",
          },
        },
      },
      { name: "legacy", _meta: { "ui/resourceUri": "ui://legacy" } },
      { name: "bad", _meta: { ui: { resourceUri: {} } } },
    ]),
    issue,
  );
  expect(tools.map((tool) => tool.name)).toEqual(["valid", "legacy"]);
  expect(tools[0].annotations?.custom).toBe("kept");
  expect(tools[0]._meta?.ui?.custom).toBe("kept");
  expect(cachedTools("[", issue)).toEqual([]);
});
function invoke(method: string, receiver: object, ...args: unknown[]): unknown {
  const actual: unknown = Reflect.get(Book.prototype, method);
  if (typeof actual !== "function") throw Error("Missing actual Book method");
  return Reflect.apply(actual, receiver, args);
}
test("actual Book messages/older use validated rows and raw pagination count remains authoritative", async () => {
  const raw = Array.from({ length: 101 }, (_, index) => ({
      ...row,
      id: 101 - index,
      author: index === 5 ? {} : row.author,
    })),
    frames: string[] = [];
  const receiver = {
    sendTo,
    get: () => "abcdef",
    files: () => [file],
    acksList: () => [],
    sql: { exec: () => ({ toArray: () => raw }) },
    messageRows: (rows: readonly unknown[]) =>
      storedMessageRows(rows, "abcdef", (id) =>
        id === file.id ? file : undefined,
      ),
  };
  const messages = invoke("messages", receiver);
  expect(messages).toHaveLength(100);
  await invoke(
    "runCommand",
    receiver,
    { send: (value: string) => frames.push(value) },
    row.author,
    { t: "older", thread: "main" },
  );
  const value: unknown = JSON.parse(frames[0]);
  if (
    !value ||
    typeof value !== "object" ||
    !("messages" in value) ||
    !Array.isArray(value.messages) ||
    !("more" in value)
  )
    throw Error("Missing actual older event");
  expect(value.more).toBe(true);
  expect(value.messages).toHaveLength(99);
  for (const message of value.messages)
    expect(MessageSchema.safeParse(message).success).toBe(true);
});
test("actual closeAsk rejects malformed choices before mutation and preserves terminal/extension fields", () => {
  let raw = '{"options":[{}]}',
    updates = 0;
  const events: unknown[] = [];
  const receiver = {
    sendTo,
    bind: () => {},
    answerTo: () => null,
    sql: {
      exec: (sql: string) => {
        if (sql.startsWith("UPDATE")) updates++;
        return { toArray: () => [{ choices: raw }] };
      },
    },
    broadcast: (value: unknown) => events.push(value),
    ctx: { waitUntil: () => {} },
    askWait: async () => {},
  };
  expect(invoke("closeAsk", receiver, "abcdef", 1, row.author)).toEqual({
    ok: false,
  });
  expect(updates).toBe(0);
  raw = '{"options":["Yes","No"],"multi":false,"extension":"kept"}';
  expect(invoke("closeAsk", receiver, "abcdef", 1, row.author)).toEqual({
    ok: true,
  });
  expect(updates).toBe(1);
  const event = events[0];
  if (
    !event ||
    typeof event !== "object" ||
    !("choices" in event) ||
    typeof event.choices !== "string"
  )
    throw Error("Missing closed event");
  expect(storedChoices(event.choices)).toMatchObject({
    options: ["Yes", "No"],
    closed: "terminal",
    extension: "kept",
  });
});
test("access-requested HTTP validates before binding, owner lookup or notice posting", async () => {
  let effects = 0;
  const receiver = {
    sendTo,
    get: () => {
      effects++;
      return null;
    },
    set: () => {
      effects++;
    },
    env: {
      DB: {
        prepare: () => {
          effects++;
          throw Error("No DB work expected");
        },
      },
    },
    addMessage: () => {
      effects++;
    },
  };
  expect(
    AccessRequested.safeParse({ who: "member@example.test", name: null })
      .success,
  ).toBe(true);
  for (const raw of [
    "not JSON",
    JSON.stringify({ who: {} }),
    JSON.stringify({ who: "member@example.test", name: [] }),
  ]) {
    const result = await invoke(
      "fetch",
      receiver,
      new Request("https://book.internal/access-requested?book=abcdef", {
        method: "POST",
        body: raw,
      }),
    );
    if (!(result instanceof Response)) throw Error("Expected Book response");
    expect(result.status).toBe(400);
  }
  expect(effects).toBe(0);
});

test("SQLite answers_ask survives history normalization without admitting malformed flags", () => {
  const values = storedMessageRows(
    [1, 0, null, true, false, undefined, "1", 2].map((answers_ask, index) => ({
      ...row,
      id: index + 1,
      answers_ask,
    })),
    "abcdef",
  );
  expect(values.map((value) => value.id)).toEqual([1, 2, 3, 4, 5, 6]);
  expect(values.map((value) => value.answers_ask)).toEqual([
    true,
    false,
    undefined,
    true,
    false,
    undefined,
  ]);
  expect(values.every((value) => MessageSchema.safeParse(value).success)).toBe(
    true,
  );
});

test("actual open_file validates stored metadata and targets only the requesting person's room tabs", () => {
  const frames: string[] = [];
  const mine = { send: (value: string) => frames.push(value) },
    other = {
      send: () => {
        throw Error("private file notice leaked");
      },
    };
  let raw: unknown = file;
  const args: unknown[][] = [];
  const receiver = {
    sendTo,
    bind: (id: string) => expect(id).toBe("abcdef"),
    sql: {
      exec: (...values: unknown[]) => {
        args.push(values);
        return { toArray: () => [raw] };
      },
    },
    sockets: () => [mine, other],
    ctx: {
      getTags: (socket: unknown) => [
        socket === mine ? "member@example.test" : "other@example.test",
      ],
    },
  };
  expect(
    invoke("agentOpenFile", receiver, "abcdef", "member@example.test", file.id),
  ).toMatchObject({ ok: true, opened_in_tabs: 1 });
  expect(JSON.parse(frames[0])).toEqual({ t: "openSide", file });
  expect(args[0][1]).toBe(file.id);
  for (const value of [
    { ...file, size: "4" },
    { ...file, author: {} },
    { ...file, type: null },
  ]) {
    raw = value;
    expect(
      invoke(
        "agentOpenFile",
        receiver,
        "abcdef",
        "member@example.test",
        file.id,
      ),
    ).toMatchObject({ ok: false, error: "file metadata unavailable" });
  }
  expect(frames).toHaveLength(1);
  raw = { ...file, type: "application/zip" };
  expect(
    invoke("agentOpenFile", receiver, "abcdef", "member@example.test", file.id),
  ).toMatchObject({ ok: false });
  expect(frames).toHaveLength(1);
});

test("actual Fire card updates require owned card and emit the normalized replacement only", async () => {
  const { cardOf } = await import("../shared/card");
  const normalized = cardOf(card, "abcdef");
  let owner = "member@example.test";
  const writes: unknown[][] = [],
    events: unknown[] = [];
  const receiver = {
    sendTo,
    bind: () => {},
    members: async () => ["member@example.test"],
    sql: {
      exec: (query: string, ...values: unknown[]) => {
        if (query.startsWith("UPDATE")) writes.push(values);
        return {
          toArray: () => [{ author: owner, card: JSON.stringify(normalized) }],
        };
      },
    },
    broadcast: (value: unknown) => events.push(value),
  };
  expect(
    await invoke(
      "fireCard",
      receiver,
      "abcdef",
      "member@example.test",
      "main",
      "safe speech",
      normalized,
      7,
    ),
  ).toEqual({ ok: true, id: 7 });
  expect(writes).toEqual([[JSON.stringify(normalized), 7]]);
  expect(events).toEqual([
    { t: "msgCard", id: 7, card: JSON.stringify(normalized) },
  ]);
  owner = "other@example.test";
  expect(
    await invoke(
      "fireCard",
      receiver,
      "abcdef",
      "member@example.test",
      "main",
      "safe speech",
      normalized,
      7,
    ),
  ).toMatchObject({ ok: false, error: "not your live card" });
  expect(writes).toHaveLength(1);
  expect(events).toHaveLength(1);
});

async function openDocFixture() {
  const { Database } = await import("bun:sqlite");
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE members(book_id TEXT, email TEXT);
    CREATE TABLE epics(id TEXT);
    INSERT INTO members VALUES('abcdef','member@example.test');
    INSERT INTO epics VALUES('e1');`);
  let bound = "",
    epicReads = 0,
    socketReads = 0,
    membershipReads = 0;
  let wait: Promise<void> | undefined;
  const frames: string[] = [];
  const mine = {
      send: (value: string) => {
        frames.push(value);
      },
    },
    peer = {
      send: () => {
        throw Error("openDoc leaked to another person");
      },
    };
  const receiver = {
    sendTo,
    bind: (id: string) => {
      bound = id;
    },
    get: () => bound,
    env: {
      DB: {
        prepare: (query: string) => ({
          bind: (...values: string[]) => ({
            all: async () => {
              membershipReads++;
              await wait;
              return { results: db.query(query).all(...values) };
            },
          }),
        }),
      },
    },
    members: async () => {
      // Exercise the actual Book membership reader backed by this SQLite D1 port.
      const result = await invoke("members", receiver);
      if (
        !Array.isArray(result) ||
        !result.every((value) => typeof value === "string")
      )
        throw Error("invalid membership fixture");
      return result;
    },
    sql: {
      exec: (query: string, ...values: string[]) => {
        epicReads++;
        return { toArray: () => db.query(query).all(...values) };
      },
    },
    sockets: () => {
      socketReads++;
      return [mine, peer];
    },
    ctx: {
      getTags: (socket: unknown) => [
        socket === mine ? "member@example.test" : "peer@example.test",
      ],
    },
  };
  return {
    db,
    receiver,
    frames,
    counts: () => ({ epicReads, socketReads, membershipReads }),
    pause: (promise: Promise<void>) => {
      wait = promise;
    },
    revoke: () => {
      db.query("DELETE FROM members WHERE email=?").run("member@example.test");
    },
  };
}

test("actual openDoc rejects revoked membership before epic metadata or retained room sockets", async () => {
  const h = await openDocFixture();
  try {
    h.revoke();
    expect(
      await invoke(
        "agentOpenDoc",
        h.receiver,
        "abcdef",
        "member@example.test",
        "e1",
      ),
    ).toEqual({ ok: false, error: "forbidden" });
    expect(h.frames).toEqual([]);
    expect(h.counts()).toEqual({
      epicReads: 0,
      socketReads: 0,
      membershipReads: 1,
    });
  } finally {
    h.db.close();
  }
});

test("actual openDoc rechecks queued-call membership and validates exact room/epic events", async () => {
  const h = await openDocFixture();
  try {
    let resume: () => void = () => {};
    h.pause(
      new Promise<void>((resolve) => {
        resume = resolve;
      }),
    );
    const pending = invoke(
      "agentOpenDoc",
      h.receiver,
      "abcdef",
      "member@example.test",
      "e1",
    );
    h.revoke();
    resume();
    expect(await pending).toEqual({ ok: false, error: "forbidden" });
    expect(h.frames).toEqual([]);
    h.db
      .query("INSERT INTO members VALUES(?,?)")
      .run("abcdef", "member@example.test");
    for (const epic of ["", "e1"]) {
      expect(
        await invoke(
          "agentOpenDoc",
          h.receiver,
          "abcdef",
          "member@example.test",
          epic,
        ),
      ).toMatchObject({ ok: true, opened_in_tabs: 1 });
    }
    expect(h.frames.map((value) => JSON.parse(value))).toEqual([
      { t: "openDoc", epic: "" },
      { t: "openDoc", epic: "e1" },
    ]);
    expect(
      await invoke(
        "agentOpenDoc",
        h.receiver,
        "abcdef",
        "member@example.test",
        "missing",
      ),
    ).toMatchObject({ ok: false });
    for (const epic of [null, 42, {}, ["e1"]]) {
      expect(
        await invoke(
          "agentOpenDoc",
          h.receiver,
          "abcdef",
          "member@example.test",
          epic,
        ),
      ).toEqual({ ok: false, error: "invalid doc target" });
    }
    expect(h.frames).toHaveLength(2);
    expect(
      await invoke(
        "agentOpenDoc",
        h.receiver,
        "abcdef",
        "peer@example.test",
        "e1",
      ),
    ).toEqual({ ok: false, error: "forbidden" });
    expect(h.frames).toHaveLength(2);
    h.receiver.sockets = () => [];
    expect(
      await invoke(
        "agentOpenDoc",
        h.receiver,
        "abcdef",
        "member@example.test",
        "",
      ),
    ).toMatchObject({ ok: true, opened_in_tabs: 0 });
  } finally {
    h.db.close();
  }
});
