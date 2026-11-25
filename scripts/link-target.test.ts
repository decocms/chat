// The chip of a link to this app (src/linkTarget.ts): a member gets where it goes; anyone else, and any missing or
// hidden target, gets the same `private`, with no title, name or person in it.
import { expect, test } from "bun:test";
import { resolveLink, type LinkPeek, type LinkPorts } from "../src/linkTarget";

const me = "ana@example.test",
  bia = "bia@example.test";
type Message = NonNullable<LinkPeek["message"]>;
const messages: Record<number, Message> = {
  7: {
    thread: "main",
    author: bia,
    kind: null,
    tag: null,
    forWho: null,
    ask: false,
    threadTitle: null,
  },
  8: {
    thread: "e1",
    author: bia,
    kind: null,
    tag: null,
    forWho: null,
    ask: false,
    threadTitle: "Lançamento",
  },
  9: {
    thread: "main",
    author: bia,
    kind: null,
    tag: "fire",
    forWho: null,
    ask: false,
    threadTitle: null,
  },
  10: {
    thread: "main",
    author: me,
    kind: null,
    tag: "reminder",
    forWho: bia,
    ask: false,
    threadTitle: null,
  },
  11: {
    thread: "main",
    author: bia,
    kind: "agent",
    tag: null,
    forWho: null,
    ask: true,
    threadTitle: null,
  },
  12: {
    thread: "call",
    author: bia,
    kind: null,
    tag: null,
    forWho: null,
    ask: false,
    threadTitle: null,
  },
};
const threads: Record<string, LinkPeek["thread"]> = {
  e1: { title: "Lançamento", owner: bia },
};

function ports(
  opts: {
    member?: boolean;
    book?: { title: string; dm: string | null; icon: number | null } | null;
  } = {},
) {
  const calls: string[] = [];
  const p: LinkPorts = {
    isMember: async () => {
      calls.push("member");
      return opts.member ?? true;
    },
    book: async () => {
      calls.push("book");
      return opts.book === undefined
        ? { title: "Produto", dm: null, icon: 3 }
        : opts.book;
    },
    peek: async (q) => {
      calls.push("peek");
      return {
        message: q.message !== undefined ? (messages[q.message] ?? null) : null,
        thread: q.thread ? (threads[q.thread] ?? null) : null,
      };
    },
    people: async (emails) => {
      calls.push("people");
      return Object.fromEntries(
        emails
          .filter((e) => e === bia)
          .map((e) => [e, { name: "Bia Souza", avatar: 5 }]),
      );
    },
  };
  return { p, calls };
}

test("a member gets the message: its author, picture and thread", async () => {
  expect(await resolveLink(ports().p, "r1", me, { m: 8 })).toEqual({
    kind: "message",
    room: "r1",
    id: 8,
    thread: "e1",
    author: bia,
    name: "Bia Souza",
    avatar: 5,
    threadTitle: "Lançamento",
    roomTitle: "Produto",
  });
  // In main the chip names the room: threadTitle null, roomTitle the room's.
  expect(
    await resolveLink(ports().p, "r1", me, { m: 7, t: "main" }),
  ).toMatchObject({ kind: "message", threadTitle: null, roomTitle: "Produto" });
});

test("a member gets the thread with its owner, and the room with its icon", async () => {
  expect(await resolveLink(ports().p, "r1", me, { t: "e1" })).toEqual({
    kind: "thread",
    room: "r1",
    thread: "e1",
    title: "Lançamento",
    owner: bia,
    ownerName: "Bia Souza",
  });
  expect(await resolveLink(ports().p, "r1", me, {})).toEqual({
    kind: "room",
    room: "r1",
    title: "Produto",
    icon: 3,
  });
  expect(await resolveLink(ports().p, "r1", me, { t: "main" })).toEqual({
    kind: "room",
    room: "r1",
    title: "Produto",
    icon: 3,
  });
});

test("a DM is the other person; your own DM has no name (the client says Você)", async () => {
  const dm = { title: "", dm: [bia, me].sort().join("\n"), icon: null };
  expect(await resolveLink(ports({ book: dm }).p, "dm1", me, {})).toEqual({
    kind: "dm",
    room: "dm1",
    email: bia,
    name: "Bia Souza",
    avatar: 5,
  });
  expect(
    await resolveLink(ports({ book: dm }).p, "dm1", me, { m: 7 }),
  ).toMatchObject({ kind: "message", roomTitle: "Bia Souza" });
  const self = { title: "", dm: `${me}\n${me}`, icon: null };
  expect(await resolveLink(ports({ book: self }).p, "dm2", me, {})).toEqual({
    kind: "dm",
    room: "dm2",
    email: me,
    name: "",
    avatar: null,
  });
});

test("not a member: private, and nothing of the room is read", async () => {
  for (const q of [{}, { t: "e1" }, { m: 8 }, { t: "call" }]) {
    const { p, calls } = ports({ member: false });
    expect(await resolveLink(p, "r1", me, q)).toEqual({ kind: "private" });
    expect(calls).toEqual(["member"]);
  }
});

test("a missing room, thread or message is the same private", async () => {
  expect(await resolveLink(ports({ book: null }).p, "r1", me, {})).toEqual({
    kind: "private",
  });
  expect(await resolveLink(ports().p, "r1", me, { t: "nope" })).toEqual({
    kind: "private",
  });
  expect(await resolveLink(ports().p, "r1", me, { m: 999 })).toEqual({
    kind: "private",
  });
  // The message is in another thread than the link says.
  expect(await resolveLink(ports().p, "r1", me, { m: 8, t: "e2" })).toEqual({
    kind: "private",
  });
});

test("a message hidden from you is private: a fire, a reminder for someone else, someone else's Claude asking", async () => {
  for (const m of [9, 10, 11])
    expect(await resolveLink(ports().p, "r1", me, { m })).toEqual({
      kind: "private",
    });
  // The one it is for sees it.
  expect(await resolveLink(ports().p, "r1", bia, { m: 10 })).toMatchObject({
    kind: "message",
  });
});

test("the call chat: a member's thread with no title, private in a DM and for a non-member", async () => {
  const { p, calls } = ports();
  expect(await resolveLink(p, "r1", me, { t: "call" })).toEqual({
    kind: "thread",
    room: "r1",
    thread: "call",
    title: "",
    owner: null,
    ownerName: null,
  });
  // It is not an epic: the Book isn't asked for it.
  expect(calls).not.toContain("peek");
  expect(
    await resolveLink(ports().p, "r1", me, { m: 12, t: "call" }),
  ).toMatchObject({ kind: "message", thread: "call", threadTitle: null });
  const dm = { title: "", dm: [bia, me].sort().join("\n"), icon: null };
  expect(
    await resolveLink(ports({ book: dm }).p, "dm1", me, { t: "call" }),
  ).toEqual({ kind: "private" });
  expect(
    await resolveLink(ports({ book: dm }).p, "dm1", me, { m: 12 }),
  ).toEqual({ kind: "private" });
  expect(
    await resolveLink(ports({ member: false }).p, "r1", me, { t: "call" }),
  ).toEqual({ kind: "private" });
});
