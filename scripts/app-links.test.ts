// Links to this app in a message become chips (web/features/rich-text/appLinks.ts): the production host and the page's
// own origin count, in every form the app writes a room, thread or message link; every other link stays as it was.
import { expect, test } from "bun:test";
import { appLink, appLinkKey } from "../web/features/rich-text/appLinks";
import { richText } from "../web/features/rich-text/project";
import { localLink } from "../web/features/rich-text/linkResolver";
import type { Room } from "../shared/room";
import type { RichContext, RichNode } from "../web/features/rich-text/types";

const page = "http://localhost:8790/b/abc123";

test("a message, a thread and a room on chat.decocms.com", () => {
  expect(
    appLink("https://chat.decocms.com/b/f94aedb83899#m4531", page),
  ).toEqual({
    room: "f94aedb83899",
    message: 4531,
    path: "/b/f94aedb83899#m4531",
  });
  expect(
    appLink("https://chat.decocms.com/b/f94aedb83899?t=e12", page),
  ).toEqual({
    room: "f94aedb83899",
    thread: "e12",
    path: "/b/f94aedb83899?t=e12",
  });
  expect(
    appLink("https://chat.decocms.com/b/f94aedb83899?t=e12#m9", page),
  ).toEqual({
    room: "f94aedb83899",
    thread: "e12",
    message: 9,
    path: "/b/f94aedb83899?t=e12#m9",
  });
  expect(appLink("https://chat.decocms.com/b/f94aedb83899", page)).toEqual({
    room: "f94aedb83899",
    path: "/b/f94aedb83899",
  });
  expect(appLink("https://chat.decocms.com/b/f94aedb83899/", page)).toEqual({
    room: "f94aedb83899",
    path: "/b/f94aedb83899",
  });
  // A DM's id.
  expect(
    appLink("https://chat.decocms.com/b/dm0123456789abcdef0123", page)?.room,
  ).toBe("dm0123456789abcdef0123");
});

test("the other thread forms: #e<id>, #doc:<id>, ?t=main is the room, the call chat", () => {
  expect(appLink("https://chat.decocms.com/b/f94aedb83899#ee12", page)).toEqual(
    { room: "f94aedb83899", thread: "e12", path: "/b/f94aedb83899?t=e12" },
  );
  expect(
    appLink("https://chat.decocms.com/b/f94aedb83899#doc:e12", page),
  ).toMatchObject({ thread: "e12" });
  expect(
    appLink("https://chat.decocms.com/b/f94aedb83899?t=main", page),
  ).toEqual({ room: "f94aedb83899", path: "/b/f94aedb83899" });
  expect(
    appLink("https://chat.decocms.com/b/f94aedb83899?t=call", page),
  ).toMatchObject({ thread: "call" });
});

test("the page's own origin (localhost, a preview) and a relative path", () => {
  expect(appLink("http://localhost:8790/b/425d49130738?t=e3", page)).toEqual({
    room: "425d49130738",
    thread: "e3",
    path: "/b/425d49130738?t=e3",
  });
  expect(appLink("/b/425d49130738#m5", page)).toEqual({
    room: "425d49130738",
    message: 5,
    path: "/b/425d49130738#m5",
  });
  // The same path on another port is another origin.
  expect(appLink("http://localhost:9999/b/425d49130738", page)).toBeNull();
});

test("other links are not app links", () => {
  for (const href of [
    "https://example.org/b/425d49130738",
    "https://chat.decocms.com.evil.test/b/425d49130738",
    "http://chat.decocms.com/b/425d49130738",
    "https://chat.decocms.com/",
    "https://chat.decocms.com/settings",
    "https://chat.decocms.com/b/425d49130738/files",
    "https://chat.decocms.com/api/books/425d49130738/files/aa11",
    "https://chat.decocms.com/b/425d49130738#fabc123",
    "https://chat.decocms.com/b/425d49130738#doc",
    "https://chat.decocms.com/b/UPPER",
    "https://chat.decocms.com/b/425d49130738?t=bad%20id",
    "https://chat.decocms.com/b/425d49130738#m0",
    "mailto:a@b.test",
    "not a url",
  ])
    expect(appLink(href, page)).toBeNull();
});

test("one cache key per place, whatever the form", () => {
  const a = appLink("https://chat.decocms.com/b/f94aedb83899#ee12", page)!,
    b = appLink("http://localhost:8790/b/f94aedb83899?t=e12", page)!;
  expect(appLinkKey(a)).toBe(appLinkKey(b));
});

const room: Room = {
  id: "abc123",
  me: "jose@test.com",
  book: { title: "Room", owner: "jose@test.com" },
  members: ["jose@test.com", "other@test.com"],
  names: { "other@test.com": "Other Person" },
  avatars: { "other@test.com": 4 },
  online: [],
  messages: [
    { id: 3, thread: "e1", author: "other@test.com", ts: 1, text: "hi" },
    {
      id: 4,
      thread: "main",
      author: "other@test.com",
      ts: 2,
      text: "x",
      tag: "fire",
    },
  ],
  typing: {},
  suggestions: [],
  epics: [{ id: "e1", title: "Launch", tasks: [], owner: "other@test.com" }],
};
const context: RichContext = {
  room,
  pageUrl: "https://example.test/b/abc123",
  idPrefix: "fixture",
};
const links = (
  nodes: readonly RichNode[],
): Extract<RichNode, { kind: "link" }>[] =>
  nodes.flatMap((node) => [
    ...(node.kind === "link" ? [node] : []),
    ...("children" in node ? links(node.children) : []),
  ]);

test("in a message: a bare app URL is a chip, a labelled one an in-app link, others unchanged", () => {
  for (const mode of ["human", "markdown"] as const) {
    const found = links(
      richText(
        "veja https://chat.decocms.com/b/f94aedb83899#m4531 e https://example.org/b/f94aedb83899",
        mode,
        context,
      ),
    );
    expect(found.map((node) => node.target)).toEqual([
      {
        kind: "app",
        href: "https://chat.decocms.com/b/f94aedb83899#m4531",
        link: {
          room: "f94aedb83899",
          message: 4531,
          path: "/b/f94aedb83899#m4531",
        },
        chip: true,
      },
      {
        kind: "url",
        href: "https://example.org/b/f94aedb83899",
        external: true,
      },
    ]);
  }
  const [labelled] = links(
    richText(
      "[a sala](https://example.test/b/abc123?t=e1)",
      "markdown",
      context,
    ),
  );
  expect(labelled!.target).toMatchObject({
    kind: "app",
    chip: false,
    link: { room: "abc123", thread: "e1" },
  });
  // The room's own short links keep their own kinds.
  expect(links(richText("[x](#m3)", "markdown", context))[0]!.target.kind).toBe(
    "message",
  );
});

test("the open room answers its own messages and threads without a request", () => {
  expect(localLink(room, { room: "abc123", message: 3, path: "" })).toEqual({
    kind: "message",
    room: "abc123",
    id: 3,
    thread: "e1",
    author: "other@test.com",
    name: "Other Person",
    avatar: 4,
    threadTitle: "Launch",
    roomTitle: "Room",
  });
  expect(localLink(room, { room: "abc123", message: 4, path: "" })).toEqual({
    kind: "private",
  });
  expect(localLink(room, { room: "abc123", thread: "e1", path: "" })).toEqual({
    kind: "thread",
    room: "abc123",
    thread: "e1",
    title: "Launch",
    owner: "other@test.com",
    ownerName: "Other Person",
  });
  expect(
    localLink(room, { room: "abc123", thread: "call", path: "" }),
  ).toMatchObject({ kind: "thread", thread: "call" });
  // Not loaded, the room itself (its icon is the server's), another room: ask the server.
  expect(localLink(room, { room: "abc123", message: 99, path: "" })).toBeNull();
  expect(localLink(room, { room: "abc123", path: "" })).toBeNull();
  expect(
    localLink(room, { room: "zzz999", thread: "e1", path: "" }),
  ).toBeNull();
});
