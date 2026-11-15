// Real metadata consumers with model/domain/SQL fixture ports; no provider or VM calls.
import { expect, mock, test } from "bun:test";
import { record } from "../shared/validation";
import { providerCost, caughtMessage } from "../src/providerMetadata";
import { requestContext } from "../src/track";
import { RouteResult, StartRoomResult } from "../shared/schemas";
mock.module("cloudflare:workers", () => ({
  DurableObject: class {},
  WorkerEntrypoint: class {},
  env: {},
}));
let output: unknown, usage: unknown;
mock.module("ai", () => ({
  Output: { object: (value: unknown) => value },
  generateText: async () => ({ output, usage }),
}));
let routerCosts: unknown[] = [];
const stub = {
  humanPost: async () => ({ ok: true, id: 1, thread: "main" }),
  routerInput: async () => ({
    name: "Fixture",
    memory: "context",
    messages: [
      {
        id: 2,
        author: "other@test",
        agent: false,
        tag: null,
        for_who: null,
        mentions_you: true,
        reply_author: null,
        epic_owner: null,
        thread: "main",
        text: "Summarize this",
        topic: "main",
        from: "Other",
        epic_doc: "",
        recent: "",
      },
    ],
  }),
  agentPost: async () => ({ ok: true, id: 3 }),
  agentAck: async () => {},
};
mock.module("../src/rooms", () => ({
  bookStub: () => stub,
  createBook: async () => "created",
  inviteMember: async () => {},
  storeFile: async () => {},
}));
mock.module("../src/router-jev", () => ({
  jev: async () => ({ decision: "answer", why: "known", cost: 0.25 }),
  own: async () => ({ decision: "wake", why: "owned", cost: 0 }),
}));
const { routeMessage } = await import("../src/route-home"),
  { startRoom } = await import("../src/start-room"),
  { gate } = await import("../src/router");
function fixture() {
  return {
    MODEL_ROUTE: "synthetic",
    MODEL_FAST: "synthetic",
    DB: {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            if (sql.startsWith("INSERT INTO router_log"))
              routerCosts.push(values[8]);
            return this;
          },
          all: async () => ({
            results: sql.includes("SELECT b.id, b.title")
              ? [
                  {
                    id: "owned",
                    title: "Room",
                    folder: null,
                    summary: null,
                    epics: null,
                  },
                ]
              : [],
          }),
          first: async () =>
            sql.includes("SELECT last_id") ? { last_id: 1 } : null,
          run: async () => ({ meta: { changes: 1 } }),
        };
      },
    },
  };
}
const costs: { usage: unknown; expected: number }[] = [
  { usage: { raw: { cost: 0 } }, expected: 0 },
  { usage: { raw: { cost: 0.125 } }, expected: 0.125 },
  { usage: { raw: { cost: "0.0003" } }, expected: 0.0003 },
  { usage: { raw: { cost: -0.5 } }, expected: -0.5 },
  { usage: undefined, expected: 0 },
  { usage: { raw: null }, expected: 0 },
  { usage: { raw: [] }, expected: 0 },
  { usage: { raw: { cost: Infinity } }, expected: 0 },
  { usage: { raw: { cost: "Infinity" } }, expected: 0 },
  { usage: { raw: { cost: true } }, expected: 0 },
  {
    usage: {
      raw: {
        cost: {
          valueOf() {
            throw Error("must not coerce");
          },
        },
      },
    },
    expected: 0,
  },
];
test("all three actual provider usage consumers retain finite charges and reject malformed containers", async () => {
  for (const value of costs) {
    usage = value.usage;
    expect(providerCost(usage)).toBe(value.expected);
    output = {
      room_id: "owned",
      epic_id: "",
      reason: "Known",
      alternatives: [],
      new_room_title: "",
    };
    const routed = RouteResult.parse(
      await Reflect.apply(routeMessage, undefined, [
        fixture(),
        "reader@test",
        "Message",
      ]),
    );
    expect(routed.cost).toBe(value.expected);
    output = { title: "New room", people: [] };
    const started = StartRoomResult.parse(
      await Reflect.apply(startRoom, undefined, [
        fixture(),
        { waitUntil() {} },
        "https://local.test",
        "reader@test",
        "New room",
        "en",
      ]),
    );
    expect(started.cost).toBe(value.expected);
    routerCosts = [];
    output = {
      action: "answer",
      reply: "Known reply",
      source: "Document",
      why: "Known",
    };
    expect(
      await Reflect.apply(gate, undefined, [
        fixture(),
        { email: "reader@test", agent: "agent" },
        "owned",
      ]),
    ).toBe(false);
    expect(routerCosts).toEqual([0.25 + value.expected]);
  }
});
test("actual request context narrows CF metadata without coercion or leaking malformed objects", async () => {
  for (const cf of [
    undefined,
    null,
    [],
    { country: "BR", asn: 123, asOrganization: "Network", colo: "GRU" },
    {
      country: 3,
      asn: {
        toString() {
          throw Error("must not coerce");
        },
      },
      asOrganization: [],
      colo: null,
    },
    { asn: "123" },
    { asn: Infinity },
    { asn: 0 },
  ]) {
    const request = new Request(
      "https://vibebook.test/b/abcdef?utm_source=fixture",
    );
    Object.defineProperty(request, "cf", { value: cf });
    const result = await requestContext(
      { SESSION_SECRET: "synthetic" },
      request,
    );
    expect(result.path).toBe("/b/:id");
    expect(result.dims?.utm).toBe("fixture");
    expect(result.visitor).toHaveLength(16);
    if (record(cf) && cf.country === "BR")
      expect(result).toMatchObject({
        country: "BR",
        dims: { asn: "123", asOrg: "Network", colo: "GRU" },
      });
    else if (record(cf) && cf.asn === "123")
      expect(result.dims?.asn).toBe("123");
    else expect(result.dims?.asn).toBe(undefined);
  }
});
test("caught diagnostics preserve real/string/message errors without object coercion", () => {
  expect(caughtMessage(Error("known"))).toBe("known");
  expect(caughtMessage("text failure")).toBe("text failure");
  expect(caughtMessage({ message: "provider failure" })).toBe(
    "provider failure",
  );
  expect(
    caughtMessage({
      toString() {
        throw Error("must not stringify");
      },
    }),
  ).toBe("Unknown error");
});

test("actual key-check consumer returns non-Error provider failures without implicit success", async () => {
  const { checkFreestyleKey } = await import("../src/sandbox"),
    original = globalThis.fetch;
  try {
    for (const [error, message] of [
      [Error("known"), "known"],
      ["text failure", "text failure"],
      [{ message: "provider failure" }, "provider failure"],
      [
        {
          toString() {
            throw Error("must not stringify");
          },
        },
        "Unknown error",
      ],
    ] as const) {
      let calls = 0;
      globalThis.fetch = Object.assign(async () => {
        calls++;
        throw error;
      }, original);
      expect(
        await Reflect.apply(checkFreestyleKey, undefined, [
          { FREESTYLE_API: "http://127.0.0.1:1" },
          "synthetic",
        ]),
      ).toBe(message);
      expect(calls).toBe(1);
    }
  } finally {
    globalThis.fetch = original;
  }
});
