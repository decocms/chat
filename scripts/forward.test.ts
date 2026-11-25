import { expect, test } from "bun:test";
import { get } from "svelte/store";
import type { Message, Room } from "../shared/room";
import {
  forwardable,
  forwardText,
  pickMessage,
  withDraft,
} from "../web/features/forward/model";
import {
  clickForward,
  forwardSelection,
  startForward,
  stopForward,
} from "../web/features/forward/selection";
import {
  FORWARD_PENDING_MS,
  holdForward,
  takeForward,
} from "../web/features/forward/pending";
import {
  forwardDestinations,
  searchThreads,
} from "../web/features/forward/destinations";
import { createApplicationCopy } from "../web/features/application/copy";
import { me, room as book } from "./home-fixtures";

const pt = createApplicationCopy("pt"),
  en = createApplicationCopy("en");
const message = (id: number, extra: Partial<Message> = {}): Message => ({
  id,
  text: `text ${id}`,
  thread: "main",
  author: "ana@example.test",
  ts: id * 1000,
  ...extra,
});
const order = [1, 2, 3, 4, 5, 6];

test("a click toggles one message and becomes the anchor", () => {
  let pick = pickMessage({ ids: [3], anchor: 3 }, order, 5);
  expect(pick).toEqual({ ids: [3, 5], anchor: 5 });
  pick = pickMessage(pick, order, 3);
  expect(pick).toEqual({ ids: [5], anchor: 3 });
});

test("Shift+click selects the range from the last click, in thread order", () => {
  expect(pickMessage({ ids: [2], anchor: 2 }, order, 5, true)).toEqual({
    ids: [2, 3, 4, 5],
    anchor: 5,
  });
  // Upwards too, and it adds to what was picked before.
  expect(pickMessage({ ids: [6, 4], anchor: 4 }, order, 1, true)).toEqual({
    ids: [1, 2, 3, 4, 6],
    anchor: 1,
  });
});

test("Shift+click after unpicking a message unpicks the range", () => {
  // 4 was just unpicked (the anchor is off): the range takes its state.
  expect(pickMessage({ ids: [1, 2, 3, 5], anchor: 4 }, order, 2, true)).toEqual(
    { ids: [1, 5], anchor: 2 },
  );
});

test("Shift+click without an anchor in the list is a plain click", () => {
  expect(pickMessage({ ids: [], anchor: null }, order, 3, true)).toEqual({
    ids: [3],
    anchor: 3,
  });
  expect(pickMessage({ ids: [9], anchor: 9 }, order, 3, true)).toEqual({
    ids: [9, 3],
    anchor: 3,
  });
});

test("a click on a message that cannot be picked changes nothing", () => {
  const pick = { ids: [1], anchor: 1 };
  expect(pickMessage(pick, order, 42)).toBe(pick);
});

test("picked messages that left the loaded window stay picked", () => {
  expect(pickMessage({ ids: [0, 2], anchor: 2 }, order, 4, true)).toEqual({
    ids: [0, 2, 3, 4],
    anchor: 4,
  });
});

test("only people's and agents' messages with text or files can be forwarded", () => {
  expect(forwardable(message(1))).toBe(true);
  expect(
    forwardable(
      message(2, {
        text: "",
        files: [
          {
            id: "f1",
            name: "plan.pdf",
            type: "application/pdf",
            size: 10,
            author: "ana@example.test",
            ts: 1,
          },
        ],
      }),
    ),
  ).toBe(true);
  expect(forwardable(message(3, { deleted: 5, text: "" }))).toBe(false);
  expect(forwardable(message(4, { text: "  " }))).toBe(false);
  expect(forwardable(message(5, { tag: "reminder" }))).toBe(false);
  expect(forwardable(message(6, { tag: "issue" }))).toBe(false);
});

test("the package is one quote block: name, time, text and files of each message", () => {
  const text = forwardText(
    [
      {
        who: "Ana Souza",
        when: "14:32, 25/11/2026",
        text: "Primeira linha\r\n\r\nTerceira linha\n",
        files: [],
      },
      {
        who: "Bruno Lima",
        when: "14:35, 25/11/2026",
        text: "Segue o plano",
        files: ["plano.pdf"],
      },
      {
        who: "Bruno Lima",
        when: "14:36, 25/11/2026",
        text: "",
        files: ["a.png", "b.png"],
      },
    ],
    "Sala de teste › Lançamento",
    pt,
  );
  expect(text).toBe(
    [
      "Encaminhado de Sala de teste › Lançamento",
      "> Ana Souza · 14:32, 25/11/2026",
      "> Primeira linha",
      ">",
      "> Terceira linha",
      ">",
      "> Bruno Lima · 14:35, 25/11/2026",
      "> Segue o plano",
      "> Anexo: plano.pdf",
      ">",
      "> Bruno Lima · 14:36, 25/11/2026",
      "> Anexos: a.png, b.png",
    ].join("\n"),
  );
  // Every line after the first is a quote line, so the chat draws one quote (rich-text `human`).
  expect(
    text
      .split("\n")
      .slice(1)
      .every((line) => /^>( |$)/.test(line)),
  ).toBe(true);
});

test("the package speaks the app's language", () => {
  expect(
    forwardText(
      [{ who: "Ana", when: "14:32, 11/25/2026", text: "Hi", files: ["x.pdf"] }],
      "Test room",
      en,
    ),
  ).toBe(
    "Forwarded from Test room\n> Ana · 14:32, 11/25/2026\n> Hi\n> Attachment: x.pdf",
  );
  expect(forwardText([], "Test room", en)).toBe("");
});

test("the package goes after a draft that is already in the composer", () => {
  expect(withDraft("", "pkg")).toBe("pkg");
  expect(withDraft("Olha isso:  \n", "pkg")).toBe("Olha isso:\n\npkg");
});

test("selection mode keeps each picked message, also after it leaves the list", () => {
  const list = [message(1), message(2), message(3), message(4)];
  startForward(list[1]!, "room1");
  expect(get(forwardSelection)).toMatchObject({
    room: "room1",
    thread: "main",
    ids: [2],
    ranged: false,
  });
  clickForward(list, 4, true);
  expect(get(forwardSelection)).toMatchObject({ ids: [2, 3, 4], ranged: true });
  // Messages 1 and 2 leave the loaded window; a click on 4 unpicks it, and 2 and 3 stay with their text.
  clickForward(list.slice(2), 4, false);
  const after = get(forwardSelection)!;
  expect(after.ids).toEqual([2, 3]);
  expect(after.messages[2]?.text).toBe("text 2");
  stopForward();
  expect(get(forwardSelection)).toBeNull();
});

test("a pending forward is taken once, by its own account, room and thread", () => {
  holdForward({
    account: "ana@example.test",
    roomId: "dest",
    thread: "t1",
    text: "pkg",
    files: [],
    at: 1000,
  });
  expect(takeForward("ana@example.test", "dest", "main", 1001)).toBeNull();
  expect(takeForward("bia@example.test", "dest", "t1", 1001)).toBeNull();
  expect(takeForward("ana@example.test", "dest", "t1", 1001)?.text).toBe("pkg");
  expect(takeForward("ana@example.test", "dest", "t1", 1002)).toBeNull();
  holdForward({
    account: "ana@example.test",
    roomId: "dest",
    thread: "t1",
    text: "late",
    files: [],
    at: 0,
  });
  expect(
    takeForward("ana@example.test", "dest", "t1", FORWARD_PENDING_MS + 1),
  ).toBeNull();
});

test("the picker lists this room's threads, your other rooms and your DMs", () => {
  const room: Room = {
    id: "aaaaaa",
    me: "me@test.com",
    book: { title: "Room aaaaaa", owner: "me@test.com" },
    members: ["me@test.com"],
    online: [],
    messages: [],
    typing: {},
    suggestions: [],
    epics: [
      { id: "old", title: "Old thread", tasks: [], last: 1 },
      { id: "new", title: "New thread", tasks: [], last: 5 },
      { id: "shut", title: "Done thread", tasks: [], done: true },
    ],
  } as unknown as Room;
  const account = me({
    books: [
      book("aaaaaa"),
      book("bbbbbb", { title: "Launch" }),
      book("dm00000000000000000bb", {
        dm: 1,
        members: "me@test.com,bia@example.test",
      }),
    ],
  });
  const words = { main: "Sala principal", you: "Você" };
  const rows = forwardDestinations(account, room, "", words);
  expect(rows.map((row) => [row.group, row.title, row.thread])).toEqual([
    ["here", "Sala principal", "main"],
    ["here", "New thread", "new"],
    ["here", "Old thread", "old"],
    ["rooms", "Launch", "main"],
    ["dms", "bia@example.test", "main"],
    ["dms", "Você", "main"],
  ]);
  expect(
    forwardDestinations(account, room, "laun", words).map((row) => row.title),
  ).toEqual(["Launch"]);
  expect(
    forwardDestinations(account, room, "old", words).map((row) => row.title),
  ).toEqual(["Old thread"]);
  expect(
    searchThreads(
      {
        rooms: 2,
        epics: [
          {
            id: "t1",
            title: "Here",
            done: false,
            ts: 1,
            room_id: "aaaaaa",
            room: "Room aaaaaa",
          },
          {
            id: "t2",
            title: "There",
            done: false,
            ts: 1,
            room_id: "bbbbbb",
            room: "Launch",
          },
          {
            id: "t3",
            title: "Closed",
            done: true,
            ts: 1,
            room_id: "bbbbbb",
            room: "Launch",
          },
        ],
        messages: [],
      },
      "aaaaaa",
    ).map((row) => [row.roomId, row.thread, row.detail]),
  ).toEqual([["bbbbbb", "t2", "Launch"]]);
});
