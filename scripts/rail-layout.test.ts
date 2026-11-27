// The rail with folders (web/features/app-navigation/railFolders.ts): the changes a drop or a menu item makes.
import { expect, test } from "bun:test";
import {
  applyIntent,
  canStep,
  combine,
  dropIntent,
  folderSignals,
  newFolder,
  newFolderId,
  placeInFolder,
  placeRoot,
  railEntries,
  shapeOf,
  step,
  takeOut,
  type RailHit,
  type RailShape,
} from "../web/features/app-navigation/railFolders";
import { RAIL_FOLDER_ID } from "../shared/schemas";
import { room } from "./home-fixtures";

const rail: RailShape = [
  { room: "a" },
  { folder: "fx", rooms: ["b", "c"] },
  { room: "d" },
];

test("the rail reads rooms and folders by position; a room whose folder is gone stands alone; DMs are not on it", () => {
  const entries = railEntries(
    [
      room("d", { position: 4 }),
      room("c", { position: 3, rail_folder: "fx" }),
      room("a", { position: 0 }),
      room("b", { position: 2, rail_folder: "fx" }),
      room("z", { position: 5, rail_folder: "gone" }),
      room("dm", { dm: 1 }),
    ],
    [{ id: "fx", name: null, tint: null, position: 1 }],
  );
  expect(shapeOf(entries)).toEqual([...rail, { room: "z" }]);
});

test("a room on a room makes a folder in the target's place; on a folder it joins it", () => {
  expect(combine(rail, "d", "a", "fnew")).toEqual([
    { folder: "fnew", rooms: ["a", "d"] },
    { folder: "fx", rooms: ["b", "c"] },
  ]);
  expect(combine(rail, "a", "fx", "fnew")).toEqual([
    { folder: "fx", rooms: ["b", "c", "a"] },
    { room: "d" },
  ]);
  // Out of a two-room folder onto a room: the folder dissolves, its last room stands in its place.
  expect(combine(rail, "b", "d", "fnew")).toEqual([
    { room: "a" },
    { room: "c" },
    { folder: "fnew", rooms: ["d", "b"] },
  ]);
  expect(combine(rail, "b", "fx", "fnew")).toBe(rail);
});

test("a room out of a folder: a folder with one room left dissolves", () => {
  expect(takeOut(rail, "b")).toEqual([
    { room: "a" },
    { room: "c" },
    { room: "b" },
    { room: "d" },
  ]);
  expect(placeRoot(rail, "c", "a")).toEqual([
    { room: "c" },
    { room: "a" },
    { room: "b" },
    { room: "d" },
  ]);
  expect(placeRoot(rail, "fx", null)).toEqual([
    { room: "a" },
    { room: "d" },
    { folder: "fx", rooms: ["b", "c"] },
  ]);
  expect(placeInFolder(rail, "c", "fx", "b")).toEqual([
    { room: "a" },
    { folder: "fx", rooms: ["c", "b"] },
    { room: "d" },
  ]);
  expect(placeInFolder(rail, "d", "fx", null)).toEqual([
    { room: "a" },
    { folder: "fx", rooms: ["b", "c", "d"] },
  ]);
});

test("the room menu: a new folder, a step up or down inside a folder or on the rail", () => {
  expect(newFolder(rail, "a", "fnew")[0]).toEqual({
    folder: "fnew",
    rooms: ["a"],
  });
  expect(newFolder(rail, "b", "fnew")).toEqual([
    { room: "a" },
    { room: "c" },
    { folder: "fnew", rooms: ["b"] },
    { room: "d" },
  ]);
  expect(step(rail, "c", -1)[1]).toEqual({ folder: "fx", rooms: ["c", "b"] });
  expect(
    step(rail, "fx", 1).map((item) =>
      "room" in item ? item.room : item.folder,
    ),
  ).toEqual(["a", "d", "fx"]);
  expect(canStep(rail, "b", -1)).toBe(false);
  expect(canStep(rail, "a", -1)).toBe(false);
  expect(canStep(rail, "d", -1)).toBe(true);
  expect(RAIL_FOLDER_ID.test(newFolderId())).toBe(true);
});

test("a drop's intent: a tile's middle is together, its edges before or after; an open folder's box takes rooms in", () => {
  const hits: RailHit[] = [
    { id: "a", kind: "room", in: null, top: 0, bottom: 36 },
    {
      id: "fx",
      kind: "folder",
      in: null,
      top: 46,
      bottom: 160,
      head: { top: 52, bottom: 88 },
    },
    { id: "b", kind: "room", in: "fx", top: 98, bottom: 134 },
    { id: "d", kind: "room", in: null, top: 170, bottom: 206 },
  ];
  const d = { id: "d", kind: "room" as const, in: null };
  expect(dropIntent(d, 18, hits)).toEqual({ kind: "combine", target: "a" });
  expect(dropIntent(d, 2, hits)).toEqual({
    kind: "place",
    in: null,
    before: "a",
  });
  expect(dropIntent(d, 34, hits)).toEqual({
    kind: "place",
    in: null,
    before: "fx",
  });
  expect(dropIntent(d, 70, hits)).toEqual({ kind: "combine", target: "fx" });
  expect(dropIntent(d, 110, hits)).toEqual({
    kind: "place",
    in: "fx",
    before: "b",
  });
  expect(dropIntent(d, 130, hits)).toEqual({
    kind: "place",
    in: "fx",
    before: null,
  });
  // b dragged below its folder's box: out, onto the rail.
  const b = { id: "b", kind: "room" as const, in: "fx" };
  expect(dropIntent(b, 165, hits)).toEqual({
    kind: "place",
    in: null,
    before: "d",
  });
  expect(
    applyIntent(rail, "b", { kind: "place", in: null, before: "d" }, "f"),
  ).toEqual([{ room: "a" }, { room: "c" }, { room: "b" }, { room: "d" }]);
  // A folder is never put inside another: only before or after.
  const fx = { id: "fx", kind: "folder" as const, in: null };
  expect(dropIntent(fx, 18, hits)).toEqual({
    kind: "place",
    in: null,
    before: "d",
  });
});

test("a closed folder's signals: the summed red number (asks only) and the strongest news", () => {
  const rooms = [
    room("a", { last_human_id: 0, last_agent_id: 3 }),
    room("b", { last_human_id: 4 }),
  ];
  const w = (book_id: string, ref: string) => ({
    book_id,
    room: "",
    ref,
    thread: "main",
    topic: null,
    author: "",
    author_name: null,
    text: "",
    ts: 1,
  });
  expect(
    folderSignals(rooms, {}, [
      w("a", "m1"),
      w("b", "m2"),
      w("b", "t1"),
      w("z", "m3"),
    ]),
  ).toEqual({
    count: 2,
    unread: "human",
  });
  expect(folderSignals(rooms, { b: 4 }, [])).toEqual({
    count: 0,
    unread: "agent",
  });
});
