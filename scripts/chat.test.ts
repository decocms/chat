import { chatTime, chatDateTime, chatZone } from "../web/features/chat/time";
import { productionStatuses } from "../web/features/chat/production";
import { expect, test } from "bun:test";
import { visibleChatMessages } from "../web/features/chat/privacy";
import type { Room, Message } from "../shared/room";
import {
  canStartThread,
  continues,
  foldMessages,
  messageFooters,
  threadWorkers,
  reminderParts,
} from "../web/features/chat/model";
import { agentMark } from "../web/lib/components/agent";
const message = (id: number, text = "text", thread = "main"): Message => ({
  id,
  text,
  thread,
  author: "me@test",
  ts: id * 1000,
});
const room = (messages: Message[]): Room => ({
  id: "r",
  me: "me@test",
  book: { title: "Room", owner: "me@test" },
  members: ["me@test"],
  online: [],
  messages,
  typing: {},
  suggestions: [],
  epics: [],
});
test("a message that already started a thread, itself or through its line in main, offers no second thread", () => {
  const inner = message(5, "inside", "e1");
  const line = { ...message(6, "Nova thread"), reply_to: 5 };
  const fresh = message(7, "other", "e1");
  const epic = (id: string, from_msg: number) =>
    ({
      id,
      title: id,
      from_msg,
      tasks: [],
    }) as unknown as Room["epics"][number];
  // A thread view: main's line is not loaded, only the room's origins carry it.
  const r: Room = {
    ...room([inner, fresh]),
    origins: [line],
    epics: [epic("e1", 1), epic("e2", 6)],
  };
  expect(canStartThread(r, inner)).toBe(false);
  expect(canStartThread(r, fresh)).toBe(true);
  expect(canStartThread(r, message(1))).toBe(false);
  expect(
    canStartThread({ ...r, book: { ...r.book, dm: true } } as Room, fresh),
  ).toBe(false);
});
test("chat folds only adjacent matching reminders/issues and never mutates canonical records", () => {
  const one = { ...message(1, "⏰ **daily** me\n\nbody"), tag: "reminder" },
    two = { ...one, id: 2, ts: 2000 },
    r = room([one, two, message(3), { ...two, id: 4 }]);
  const rows = foldMessages(r.messages);
  expect(rows.map((m) => m.id)).toEqual([2, 3, 4]);
  expect(rows[0].group?.map((m) => m.id)).toEqual([1, 2]);
  expect(rows[0].runs).toEqual([1000, 2000]);
  expect(one).not.toHaveProperty("runs");
  expect(reminderParts(rows[0])).toMatchObject({
    name: "daily",
    head: "me",
    body: "body",
  });
  expect(continues(message(1), message(2))).toBe(true);
  expect(continues({ ...message(1), poll: "p" }, message(2))).toBe(false);
  expect(continues(message(1), { ...message(2), kind: "agent" })).toBe(false);
});
test("receipts target exact latest eligible message, suppress matching acks, deduplicate newest status and exclude dismissed", () => {
  const r = room([
    message(1),
    { ...message(2), kind: "agent", author: "reader@test" },
    message(3),
  ]);
  r.acks = [
    { msg_id: 1, email: "a@test", who: "gpt", status: "doing", ts: 1 },
    { msg_id: 1, email: "a@test", who: "gpt", status: "done", ts: 2 },
    { msg_id: 3, email: "b@test", who: "claude", status: "dismissed", ts: 3 },
  ];
  r.receipts = [
    { email: "reader@test", who: "gpt", read: 2, delivered: 2 },
    { email: "a@test", who: "gpt", read: 1, delivered: 1 },
    { email: "b@test", who: "claude", read: 0, delivered: 3 },
  ];
  const result = messageFooters(r, "main", 10);
  expect(result.get(1)?.statuses.map((s) => s.kind)).toEqual(["done"]);
  expect(result.get(1)?.readers.map((x) => x.receipt.email)).toEqual([
    "reader@test",
  ]);
  expect(result.get(2)).toBeUndefined();
  expect(result.get(3)?.statuses).toEqual([]);
  expect(result.get(3)?.readers[0].read).toBe(false);
  expect(r.acks[0].status).toBe("doing");
});
test("expired doing statuses become task-owner waiting or idle while blocked notes remain data", () => {
  const r = room([message(1), message(2), message(3)]);
  r.epics = [
    {
      id: "e",
      title: "Epic",
      from_msg: 1,
      tasks: [
        {
          id: "t",
          title: "Task",
          done: false,
          status: "todo",
          owner: "owner@test",
        },
      ],
    },
  ];
  r.acks = [
    { msg_id: 1, email: "a", who: "Claude", status: "doing", ts: 0 },
    { msg_id: 2, email: "b", who: "GPT", status: "doing", ts: 0 },
    {
      msg_id: 3,
      email: "c",
      who: "GPT",
      status: "blocked",
      ts: 0,
      note: "<script>hostile</script>",
    },
  ];
  const result = messageFooters(r, "main", 21 * 60_000);
  expect(result.get(1)?.statuses[0]).toMatchObject({
    kind: "waiting",
    owners: ["owner@test"],
  });
  // Idle (here a "doing" older than 20 minutes) is not a line under the message, only a read receipt.
  expect(result.get(2)?.statuses ?? []).toEqual([]);
  expect(result.get(3)?.statuses[0].ack.note).toBe("<script>hostile</script>");
});
test("worker state excludes branched origins, respects latest completion and falls back to recent epic agent activity", () => {
  const r = room([
    message(1),
    message(2),
    { ...message(3, "working", "e"), kind: "agent", via: "Codex", ts: 10000 },
  ]);
  r.epics = [{ id: "e", title: "Epic", from_msg: 1, tasks: [] }];
  r.acks = [
    { msg_id: 1, email: "a", who: "GPT", status: "doing", ts: 10000 },
    { msg_id: 2, email: "b", who: "Claude", status: "doing", ts: 10000 },
    { msg_id: 2, email: "b", who: "Claude", status: "done", ts: 11000 },
  ];
  expect(threadWorkers(r, "main", 12000)).toEqual([]);
  expect(threadWorkers(r, "e", 12000)).toEqual([{ who: "GPT", email: "a" }]);
  r.acks = [];
  expect(threadWorkers(r, "e", 12000)).toEqual([
    { who: "Codex", email: "me@test" },
  ]);
  r.epics[0].done = true;
  expect(threadWorkers(r, "e", 12000)).toEqual([]);
  expect(threadWorkers(r, "pre:0", 12000)).toEqual([]);
  expect(agentMark("Codex")).toBe("◎");
  expect(agentMark("gemini-3-pro")).toBe("✦");
  expect(agentMark("Antigravity")).toBe("✦");
  expect(agentMark("claude-opus-5-5")).toBe("✻");
});
test("an agent that takes a main-thread message to an epic shows working in that epic, and main names it", () => {
  const r = room([
    message(1, "faz isso"),
    { ...message(2, "plano", "e"), kind: "agent", author: "a", ts: 10500 },
  ]);
  r.epics = [{ id: "e", title: "Aviso no épico", tasks: [] }];
  r.acks = [
    { msg_id: 1, email: "a", who: "Claude", status: "doing", ts: 10000 },
  ];
  // Main still shows who works, now with the epic it went to.
  expect(threadWorkers(r, "main", 12000)).toEqual([
    { who: "Claude", email: "a", epic: { id: "e", title: "Aviso no épico" } },
  ]);
  // The epic shows the worker too.
  expect(threadWorkers(r, "e", 12000)).toEqual([{ who: "Claude", email: "a" }]);
  // A post before the ack is not where the work went.
  r.messages[1] = { ...r.messages[1], ts: 9000 };
  expect(threadWorkers(r, "main", 12000)).toEqual([
    { who: "Claude", email: "a" },
  ]);
  // (Its own recent post still shows there, as before; not as the ack's worker.)
  expect(threadWorkers(r, "e", 12000)).not.toContainEqual({
    who: "Claude",
    email: "a",
  });
  // A finished ack stops both.
  r.messages[1] = { ...r.messages[1], ts: 10500 };
  r.acks.push({
    msg_id: 1,
    email: "a",
    who: "Claude",
    status: "done",
    ts: 11000,
  });
  expect(threadWorkers(r, "main", 12000)).toEqual([]);
  expect(threadWorkers(r, "e", 12000)).toEqual([]);
});
test("latest done or dismissed ack never revives an older doing session in footer or epic worker fallback", () => {
  const r = room([message(1)]);
  r.epics = [{ id: "e", title: "Epic", from_msg: 1, tasks: [] }];
  for (const status of ["done", "dismissed"]) {
    r.acks = [
      {
        msg_id: 1,
        email: "agent@test",
        who: "Codex",
        status: "doing",
        ts: 1000,
      },
      { msg_id: 1, email: "agent@test", who: "Codex", status, ts: 2000 },
    ];
    expect(threadWorkers(r, "e", 3000)).toEqual([]);
    expect(
      messageFooters(r, "main", 3000)
        .get(1)
        ?.statuses.map((s) => s.kind) || [],
    ).toEqual(status === "done" ? ["done"] : []);
  }
});

test("receipt reconnect rows coalesce logical readers without duplicate keys or losing read progress", () => {
  const r = room([message(1), message(2)]);
  r.receipts = [
    { email: "reader@test", who: "Codex", agent: "old", read: 1, delivered: 2 },
    { email: "reader@test", who: "Codex", agent: "new", read: 2, delivered: 2 },
  ];
  const footer = messageFooters(r, "main", 3000).get(2)!;
  expect(footer.readers).toHaveLength(1);
  expect(footer.readers[0].read).toBe(true);
  expect(r.receipts).toHaveLength(2);
});

test("Fire transcript pieces stay canonical while visible rows and receipt placement exclude them", () => {
  const ordinary = message(1, "Public"),
    fire = { ...message(2, "Spoken private working piece"), tag: "fire" },
    r = room([ordinary, fire]);
  r.receipts = [
    { email: "reader@test", who: "Reader", read: 2, delivered: 2, ts: 3 },
  ];
  expect(visibleChatMessages(r, "main").map((row) => row.id)).toEqual([1]);
  const footers = messageFooters(r, "main", 4);
  expect(footers.has(2)).toBe(false);
  expect(footers.get(1)?.readers).toHaveLength(1);
  expect(r.messages).toEqual([ordinary, fire]);
});

test("chat time is 24h in every locale, across locale switches and date boundaries (Gui #3586)", () => {
  for (const locale of ["en-US", "pt-BR", "en-GB", "pt-BR"])
    for (const ts of [
      0,
      Date.UTC(2026, 2, 8, 6, 59),
      Date.UTC(2026, 10, 1, 6, 1),
      -1,
      NaN,
      Infinity,
    ])
      expect(chatTime(locale, ts)).toBe(
        new Date(ts).toLocaleTimeString(locale, {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }),
      );
});

test("cached full chat timestamp retains browser date/time defaults", () => {
  for (const locale of ["en-US", "pt-BR", "en-GB", "pt-BR"])
    for (const ts of [
      0,
      Date.UTC(2026, 2, 8, 6, 59),
      Date.UTC(2026, 10, 1, 6, 1),
      -1,
      NaN,
      Infinity,
    ])
      expect(chatDateTime(locale, ts)).toBe(
        new Date(ts).toLocaleString(locale),
      );
});

test("production changes cue requires this reader’s later human message in the exact deployed epic", () => {
  const r = room([]);
  r.epics = [
    {
      id: "e",
      title: "Epic",
      tasks: [],
      prod: { stage: "verified", at: 1000, note: "Verified before" },
    },
  ];
  const own = { ...message(2, "change", "e"), ts: 1001 };
  for (const incoming of [
    { ...own, ts: 1000 },
    { ...own, kind: "agent" },
    { ...own, author: "other@test" },
    { ...own, thread: "other" },
  ]) {
    r.messages = [incoming];
    expect(productionStatuses(r).get("e")).toBe("verified");
  }
  r.messages = [own];
  expect(productionStatuses(r).get("e")).toBe("changes");
  expect(r.epics[0]!.prod?.stage).toBe("verified");
  expect(r.epics[0]!.prod?.note).toBe("Verified before");
});
test("production cue keeps done/deploy semantics and resets when the next version catches up", () => {
  const r = room([{ ...message(2, "change", "e"), ts: 2000 }]);
  r.epics = [
    {
      id: "e",
      title: "Epic",
      tasks: [],
      done: true,
      prod: { stage: "verified", at: 1000, note: "Verified" },
    },
  ];
  expect(productionStatuses(r).get("e")).toBe("verified");
  r.epics = [
    { ...r.epics[0]!, done: false, prod: { stage: "deployed", at: 1000 } },
  ];
  expect(productionStatuses(r).get("e")).toBe("changes");
  r.epics = [{ ...r.epics[0]!, prod: { stage: "deployed", at: 2000 } }];
  expect(productionStatuses(r).get("e")).toBe("live");
  r.epics = [{ ...r.epics[0]!, prod: { stage: "verified" } }];
  expect(productionStatuses(r).get("e")).toBe("verified");
  r.epics = [{ ...r.epics[0]!, prod: null }];
  expect(productionStatuses(r).has("e")).toBe(false);
});
test("production cue includes loaded origins but canonical message IDs take precedence", () => {
  const r = room([
    { ...message(5, "canonical", "e"), author: "other@test", ts: 3000 },
  ]);
  r.epics = [
    {
      id: "e",
      title: "Epic",
      tasks: [],
      prod: { stage: "verified", at: 1000 },
    },
  ];
  r.origins = [{ ...message(5, "stale origin duplicate", "e"), ts: 2000 }];
  expect(productionStatuses(r).get("e")).toBe("verified");
  r.origins.push({ ...message(6, "origin change", "e"), ts: 2000 });
  expect(productionStatuses(r).get("e")).toBe("changes");
  const before = JSON.stringify(r);
  productionStatuses(r);
  expect(JSON.stringify(r)).toBe(before);
});

test("chat zone is the viewer's UTC offset, empty for invalid dates", () => {
  expect(chatZone(Date.UTC(2026, 10, 19, 20, 58))).toMatch(
    /^GMT([+-]\d{1,2}(:\d{2})?)?$/,
  );
  expect(chatZone(NaN)).toBe("");
  expect(chatTime("en-US", Date.UTC(2026, 10, 19, 20, 58))).not.toMatch(
    /AM|PM/,
  );
});
