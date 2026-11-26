// A Claude's hook question (⏸/❓) and its human's answer are that human's alone (src/privateAsk.ts): the rows the
// Book reads for any other member never include them, its own human still gets the ask with its buttons, and the
// answer the hook polls for (Book.answerTo) is still found.
import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import {
  BACKFILL_SQL,
  PUBLIC_SQL,
  VISIBLE_SQL,
  privateOwner,
  recipients,
} from "../src/privateAsk";
import { visibleChatMessages } from "../web/features/chat/privacy";
import type { Message, Room } from "../shared/room";

const OWNER = "ana@test";
const OTHER = "bia@test";
const CHOICES = '{"options":["Aprovar","Negar"],"multi":false}';
const ASK =
  "⏸ Seu Claude pede permissão: **Bash**\n`rm -rf /Users/ana/secret`\n\nSó vale a resposta da sua conta logada aqui.";

function room() {
  const db = new Database(":memory:");
  db.run(
    `CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, thread TEXT, author TEXT, text TEXT, ts INTEGER,
      kind TEXT, choices TEXT, reply_to INTEGER, private_to TEXT)`,
  );
  const add = (
    author: string,
    text: string,
    extra: {
      kind?: string;
      choices?: string;
      reply_to?: number;
      private_to?: string | null;
    } = {},
  ) =>
    Number(
      db
        .query(
          `INSERT INTO messages (thread, author, text, ts, kind, choices, reply_to, private_to) VALUES ('main', ?, ?, 0, ?, ?, ?, ?) RETURNING id`,
        )
        .get(
          author,
          text,
          extra.kind ?? null,
          extra.choices ?? null,
          extra.reply_to ?? null,
          extra.private_to ?? null,
        )!["id" as never],
    );
  const seen = (viewer: string) =>
    db
      .query(`SELECT id FROM messages WHERE ${VISIBLE_SQL()} ORDER BY id`)
      .all(viewer)
      .map((r) => (r as { id: number }).id);
  return { db, add, seen };
}

test("a new ask and its human's answer are theirs alone; every other message is the room's", () => {
  const ask = { kind: "agent", author: OWNER, text: ASK, choices: CHOICES };
  expect(privateOwner(ask)).toBe(OWNER);
  expect(
    privateOwner({
      kind: "agent",
      author: OWNER,
      text: "❓ Seu Claude pergunta: qual?",
      choices: { options: ["a"] },
    }),
  ).toBe(OWNER);
  // The owner's answer is private; someone else replying to it, or an agent's reply, is not an answer.
  expect(
    privateOwner(
      { kind: null, author: OWNER, text: "Aprovar", choices: null },
      ask,
    ),
  ).toBe(OWNER);
  expect(
    privateOwner(
      { kind: null, author: OTHER, text: "eu?", choices: null },
      ask,
    ),
  ).toBeNull();
  expect(
    privateOwner(
      { kind: "agent", author: OWNER, text: "ok", choices: null },
      ask,
    ),
  ).toBeNull();
  // An agent's poll-like choices or a quote of the opener mid-text is no ask.
  expect(
    privateOwner({
      kind: "agent",
      author: OWNER,
      text: "Qual cor?",
      choices: CHOICES,
    }),
  ).toBeNull();
  expect(
    privateOwner({ kind: "agent", author: OWNER, text: ASK, choices: null }),
  ).toBeNull();
  expect(
    privateOwner({ kind: null, author: OWNER, text: ASK, choices: null }),
  ).toBeNull();
});

test("another member never reads the ask or its answer; its human reads both and the hook finds the answer", () => {
  const r = room();
  const hello = r.add(OTHER, "bom dia");
  const ask = r.add(OWNER, ASK, {
    kind: "agent",
    choices: CHOICES,
    private_to: OWNER,
  });
  const answer = r.add(OWNER, "Aprovar", { reply_to: ask, private_to: OWNER });
  expect(r.seen(OTHER)).toEqual([hello]);
  expect(r.seen("")).toEqual([hello]); // nobody's read (the router, @vibe): the room's own only
  expect(r.seen(OWNER)).toEqual([hello, ask, answer]);
  // Book.answerTo: what permission_wait polls, unaffected by private_to.
  expect(
    r.db
      .query(
        `SELECT text FROM messages WHERE reply_to = ? AND author = ? AND kind IS NULL ORDER BY id LIMIT 1`,
      )
      .get(ask, OWNER),
  ).toEqual({ text: "Aprovar" });
  expect(
    r.db
      .query(`SELECT count(*) AS n FROM messages WHERE ${PUBLIC_SQL()}`)
      .get(),
  ).toEqual({ n: 1 });
});

test("asks already in a room are hidden by the backfill, with their owner's answers and nothing else", () => {
  const r = room();
  const hello = r.add(OTHER, "bom dia");
  const ask = r.add(OWNER, ASK, { kind: "agent", choices: CHOICES });
  const question = r.add(OWNER, "❓ Seu Claude pergunta: qual banco?", {
    kind: "agent",
    choices: '{"options":["pg","sqlite"]}',
  });
  const plan = r.add(
    OWNER,
    "⏸ Seu Claude quer seguir com este plano:\n\n1. x",
    {
      kind: "agent",
      choices: CHOICES,
    },
  );
  const answer = r.add(OWNER, "Negar", { reply_to: ask });
  const foreign = r.add(OTHER, "o que é isso?", { reply_to: ask });
  const poll = r.add(OWNER, "Qual cor?", { kind: "agent", choices: CHOICES });
  for (const q of BACKFILL_SQL) r.db.run(q);
  expect(r.seen(OTHER)).toEqual([hello, foreign, poll]);
  expect(r.seen(OWNER)).toEqual([
    hello,
    ask,
    question,
    plan,
    answer,
    foreign,
    poll,
  ]);
  // Idempotent: a second run changes nothing.
  for (const q of BACKFILL_SQL) r.db.run(q);
  expect(r.seen(OTHER)).toEqual([hello, foreign, poll]);
});

test("a private message's live push goes to its owner's tabs only", () => {
  const tabs = [
    { email: OWNER, id: 1 },
    { email: OTHER, id: 2 },
    { email: OWNER, id: 3 },
  ];
  expect(recipients(tabs, (t) => t.email, OWNER).map((t) => t.id)).toEqual([
    1, 3,
  ]);
  expect(recipients(tabs, (t) => t.email, null).map((t) => t.id)).toEqual([
    1, 2, 3,
  ]);
});

test("in the chat its human still sees the ask with its buttons; the answer row stays out of the timeline", () => {
  const base = {
    thread: "main",
    ts: 0,
    files: [],
    poll: null,
    via: null,
    tag: null,
    card: null,
    for_who: null,
  };
  const ask = {
    ...base,
    id: 7,
    author: OWNER,
    text: ASK,
    kind: "agent",
    choices: CHOICES,
    reply_to: null,
  } as Message;
  const answer = {
    ...base,
    id: 8,
    author: OWNER,
    text: "Aprovar",
    kind: null,
    choices: null,
    reply_to: 7,
  } as Message;
  const view = (me: string, messages: Message[]) =>
    visibleChatMessages(
      { me, messages, origins: [] } as unknown as Room,
      "main",
    ).map((m) => m.id);
  expect(view(OWNER, [ask, answer])).toEqual([7]);
  // What another member's app receives from the server now: neither row.
  expect(view(OTHER, [])).toEqual([]);
});
