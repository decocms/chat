import { describe, expect, test } from "bun:test";
import { get } from "svelte/store";
import type { Epic, Message } from "../shared/room";
import {
  doneEpics,
  epicAncestors,
  epicForest,
  reorderEpics,
  sidebarEpics,
  visibleEpics,
} from "../web/features/navigation/model";
import {
  createNavigationSession,
  enterNavigationThread,
  toggleNavigationBranch,
  syncNavigationSession,
} from "../web/features/navigation/session";

const epic = (
  id: string,
  parent: string | null = null,
  done = false,
): Epic => ({ id, title: id, tasks: [], parent, done });
const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};
const ids = (
  forest: ReturnType<typeof epicForest>,
  closed = new Set<string>(),
) => visibleEpics(forest, closed).map((row) => row.epic.id);

describe("epic navigation model", () => {
  test("filtered or missing parents remain visible roots; siblings retain canonical order", () => {
    const forest = epicForest([
      epic("child", "parent"),
      epic("leaf", "child"),
      epic("orphan", "absent"),
      epic("self", "self"),
    ]);
    expect(forest.roots.map((row) => row.id)).toEqual([
      "child",
      "orphan",
      "self",
    ]);
    expect(ids(forest)).toEqual(["child", "leaf", "orphan", "self"]);
    expect(epicAncestors(forest, "leaf")).toEqual(["child"]);
    expect(ids(forest, new Set(["child"]))).toEqual([
      "child",
      "orphan",
      "self",
    ]);
  });
  test("cycles, attached descendants and duplicate IDs render every ID exactly once", () => {
    const forest = epicForest([
      epic("a", "b"),
      epic("b", "c"),
      epic("c", "a"),
      epic("child", "a"),
      epic("leaf", "child"),
      epic("a"),
    ]);
    expect(ids(forest)).toEqual(["a", "child", "leaf", "b", "c"]);
    expect(forest.parents.get("a")).toBeNull();
    expect(forest.parents.get("b")).toBeNull();
    expect(forest.parents.get("c")).toBeNull();
    expect(epicAncestors(forest, "leaf")).toEqual(["child", "a"]);
  });
  test("deep imported hierarchies traverse without recursion or lost descendants", () => {
    const records = Array.from({ length: 5000 }, (_, i) =>
      epic(String(i), i ? String(i - 1) : null),
    );
    const forest = epicForest(records);
    const rows = visibleEpics(forest, new Set(), new Set(["4999"]));
    expect(rows).toHaveLength(5000);
    expect(rows.at(-1)?.depth).toBe(4999);
    expect(rows[0].busyBelow).toBe(true);
    expect(rows.at(-1)?.busyBelow).toBe(false);
    expect(ids(forest, new Set(["0"]))).toEqual(["0"]);
  });
  test("busy descendants remain signaled while closed", () => {
    const forest = epicForest([
      epic("root"),
      epic("child", "root"),
      epic("other"),
    ]);
    expect(visibleEpics(forest, new Set(["root"]), new Set(["child"]))).toEqual(
      [
        {
          epic: epic("root"),
          depth: 0,
          hidden: false,
          hasChildren: true,
          busyBelow: true,
        },
        {
          epic: epic("other"),
          depth: 0,
          hidden: false,
          hasChildren: false,
          busyBelow: false,
        },
      ],
    );
  });
  test("hidden descendants keep stable rows and controls without repeated ancestor scans", () => {
    const forest = epicForest([
      epic("root"),
      epic("child", "root"),
      epic("leaf", "child"),
      epic("other"),
    ]);
    expect(
      visibleEpics(forest, new Set(["root"]), new Set(), true).map((row) => [
        row.epic.id,
        row.hidden,
      ]),
    ).toEqual([
      ["root", false],
      ["child", true],
      ["leaf", true],
      ["other", false],
    ]);
  });
  test("done view orders by last message, then reverse canonical index", () => {
    const records = [
      epic("open"),
      epic("a", null, true),
      epic("b", null, true),
      epic("c", null, true),
    ];
    expect(
      doneEpics(records, [
        { id: 8, thread: "a", author: "me", ts: 0, text: "activity" },
      ]).map((row) => row.id),
    ).toEqual(["a", "c", "b"]);
  });
  test("reordering changes sibling positions only and preserves all room IDs and parents", () => {
    const records = [
      epic("a"),
      epic("a1", "a"),
      epic("b"),
      epic("b1", "b"),
      epic("a2", "a"),
      epic("arch", null, true),
    ];
    expect(reorderEpics(records, "a2", "a1", false)).toEqual([
      "a",
      "a2",
      "a1",
      "b",
      "b1",
      "arch",
    ]);
    expect(reorderEpics(records, "b", "a", false)).toEqual([
      "b",
      "a",
      "a1",
      "b1",
      "a2",
      "arch",
    ]);
    expect(records.map((row) => row.id)).toEqual([
      "a",
      "a1",
      "b",
      "b1",
      "a2",
      "arch",
    ]);
    expect(reorderEpics(records, "a1", "b1", false)).toBeNull();
    expect(reorderEpics(records, "arch", "a", false)).toBeNull();
    expect(reorderEpics(records, "a", "missing", false)).toBeNull();
    expect(reorderEpics(records, "a", "a", false)).toBeNull();
    expect(
      reorderEpics([epic("a"), epic("a"), epic("b")], "a", "b", true),
    ).toBeNull();
  });
});

describe("room-owned navigation session", () => {
  test("rail-only thread entries reopen ancestors without discarding the room's open tab", () => {
    const room = {
      id: "room",
      epics: [epic("parent"), epic("child", "parent")],
    };
    const session = syncNavigationSession(null, room, "child");
    session.state.update((state) => ({ ...state, suggestions: true }));
    toggleNavigationBranch(session, "parent");
    expect([...get(session.state).closed]).toEqual(["parent"]);
    expect(syncNavigationSession(session, room, "main")).toBe(session);
    expect(syncNavigationSession(session, room, "child")).toBe(session);
    expect([...get(session.state).closed]).toEqual([]);
    expect(get(session.state).suggestions).toBe(true);
    const other = syncNavigationSession(
      session,
      { id: "other", epics: [] },
      "main",
    );
    expect(other).not.toBe(session);
    expect(get(other.state).suggestions).toBe(false);
  });
  test("returning from an done thread is a new entry even while the active tab stays selected", () => {
    const session = createNavigationSession("room", false, storage());
    const forest = epicForest([
      epic("a"),
      epic("a-leaf", "a"),
      epic("b", null, true),
      epic("b-leaf", "b", true),
    ]);
    enterNavigationThread(session, forest, "a-leaf");
    toggleNavigationBranch(session, "a");
    enterNavigationThread(session, forest, "b-leaf");
    toggleNavigationBranch(session, "b");
    enterNavigationThread(session, forest, "a-leaf");
    expect([...get(session.state).closed]).toEqual(["b"]);
    enterNavigationThread(session, forest, "a-leaf");
    expect([...get(session.state).closed]).toEqual(["b"]);
  });
  test("entering a filtered done child reveals its branch when its tab opens", () => {
    const local = storage();
    local.setItem("vb.tree.room", '["parent"]');
    const session = createNavigationSession("room", false, local);
    enterNavigationThread(session, epicForest([epic("open")]), "child");
    expect(get(session.state).openedFor).toBeNull();
    const done = epicForest([
      epic("parent", null, true),
      epic("child", "parent", true),
    ]);
    enterNavigationThread(session, done, "child");
    expect([...get(session.state).closed]).toEqual([]);
    toggleNavigationBranch(session, "parent");
    enterNavigationThread(session, done, "child");
    expect([...get(session.state).closed]).toEqual(["parent"]);
  });
  test("ancestor auto-opening runs once per thread entry, preserving manual collapse and the open tab", () => {
    const local = storage();
    local.setItem("vb.tree.room", '["root","child"]');
    const session = createNavigationSession("room", false, local);
    const forest = epicForest([
      epic("root"),
      epic("child", "root"),
      epic("leaf", "child"),
    ]);
    enterNavigationThread(session, forest, "leaf");
    expect([...get(session.state).closed]).toEqual([]);
    session.state.update((state) => ({ ...state, suggestions: true }));
    toggleNavigationBranch(session, "root");
    let notifications = 0;
    const stop = session.state.subscribe(() => notifications++);
    enterNavigationThread(
      session,
      epicForest([...forest.byId.values()]),
      "leaf",
    );
    expect(notifications).toBe(1);
    expect([...get(session.state).closed]).toEqual(["root"]);
    expect(get(session.state).suggestions).toBe(true);
    enterNavigationThread(session, forest, "main");
    enterNavigationThread(session, forest, "leaf");
    expect([...get(session.state).closed]).toEqual([]);
    expect(get(session.state).suggestions).toBe(true);
    stop();
  });
  test("closed branches reload per room; another room never receives its open tab", () => {
    const local = storage();
    const a = createNavigationSession("a", false, local);
    toggleNavigationBranch(a, "root");
    a.state.update((state) => ({ ...state, suggestions: true }));
    const reload = createNavigationSession("a", false, local);
    const b = createNavigationSession("b", false, local);
    expect([...get(reload.state).closed]).toEqual(["root"]);
    expect(get(reload.state).suggestions).toBe(false);
    expect([...get(b.state).closed]).toEqual([]);
    expect(get(b.state).suggestions).toBe(false);
  });
  test("malformed and unavailable storage cannot break navigation", () => {
    for (const value of ["{bad", '"root"', "null", "{}", '["root",7]']) {
      const local = storage();
      local.setItem("vb.tree.a", value);
      expect([
        ...get(createNavigationSession("a", false, local).state).closed,
      ]).toEqual([]);
    }
    const unavailable = {
      getItem() {
        throw Error("denied");
      },
      setItem() {
        throw Error("denied");
      },
    };
    const session = createNavigationSession("a", false, unavailable);
    toggleNavigationBranch(session, "root");
    expect([...get(session.state).closed]).toEqual(["root"]);
  });
});

test("sidebar epics: pinned first in their order, then newest activity first", () => {
  const epic = (id: string, extra: Partial<Epic> = {}): Epic => ({
    id,
    title: id,
    tasks: [],
    ...extra,
  });
  const epics = [
    epic("old", { last: 10 }),
    epic("pinB", { pinned: true, last: 1 }),
    epic("new", { last: 30 }),
    epic("pinA", { pinned: true, last: 50 }),
    epic("live", { last: 5 }),
  ];
  const messages = [{ thread: "live", ts: 40 }] as Message[];
  expect(sidebarEpics(epics, messages).map((e) => e.id)).toEqual([
    "pinB",
    "pinA",
    "live",
    "new",
    "old",
  ]);
});

test("a drag names its landing by id, and its order follows a list that changed mid-drag (#4020)", async () => {
  const { current, landing } = await import("../web/lib/components/sortOrder");
  // A room arrived (N, at index 2) and one left (X) while A was dragged after C.
  expect(current(["B", "C", "A", "X", "D"], ["A", "B", "N", "C", "D"])).toEqual(
    ["B", "C", "N", "A", "D"],
  );
  expect(current(null, ["A", "B"])).toEqual(["A", "B"]);
  // Before the next peer; after the previous one when it lands last; rows of another group are skipped.
  const peer = (id: string) => id !== "s";
  expect(landing(["B", "A", "s", "C"], "A", peer)).toEqual({
    to: "C",
    after: false,
  });
  expect(landing(["B", "C", "s", "A"], "A", peer)).toEqual({
    to: "C",
    after: true,
  });
  expect(landing(["A"], "A", peer)).toBe(null);
});

test("a dragged row whose node moved shows above the page again (Gimenes #4232)", async () => {
  const { relift } = await import("../web/lib/components/sortOrder");
  const row = (o: {
    open?: boolean;
    popover?: boolean;
    connected?: boolean;
  }) => {
    const shown: number[] = [];
    return {
      shown,
      isConnected: o.connected ?? true,
      hasAttribute: (name: string) => name === "popover" && (o.popover ?? true),
      matches: () => o.open ?? false,
      showPopover: () => void shown.push(1),
    };
  };
  // Svelte moved the node: it left the top layer, so it shows again.
  const moved = row({});
  expect(relift(moved)).toBe(true);
  expect(moved.shown).toHaveLength(1);
  // Still shown, not lifted (a row without dnd-kit's popover), or gone: nothing to do.
  for (const other of [
    row({ open: true }),
    row({ popover: false }),
    row({ connected: false }),
  ]) {
    expect(relift(other)).toBe(false);
    expect(other.shown).toHaveLength(0);
  }
  expect(relift(null)).toBe(false);
});

test("sidebar epics: your last threads go first after the pinned ones", () => {
  const epic = (id: string, extra: Partial<Epic> = {}): Epic => ({
    id,
    title: id,
    tasks: [],
    ...extra,
  });
  const epics = [
    epic("old", { last: 10 }),
    epic("pin", { pinned: true, last: 1 }),
    epic("new", { last: 30 }),
    epic("mine", { last: 2 }),
    epic("gone", { last: 3 }),
  ];
  expect(
    sidebarEpics(epics, [], ["mine", "old", "deleted"]).map((e) => e.id),
  ).toEqual(["pin", "mine", "old", "new", "gone"]);
});

test("room visits: the room reopens the thread you left, and the recent three keep their order", async () => {
  const { createRoomVisits, recordRecent } =
    await import("../web/features/navigation/recent");
  expect(recordRecent(["a", "b", "c"], "b")).toEqual(["a", "b", "c"]);
  expect(recordRecent(["a", "b", "c"], "d")).toEqual(["d", "a", "b"]);
  expect(recordRecent(["a"], "main")).toEqual(["a"]);
  const saved = new Map<string, string>();
  const storage = {
    getItem: (k: string) => saved.get(k) ?? null,
    setItem: (k: string, v: string) => void saved.set(k, v),
  };
  const visits = createRoomVisits(storage, () => 1);
  visits.enter("me@x.com", "room1", "e1");
  visits.enter("me@x.com", "room1", "e2");
  visits.enter("me@x.com", "room1", "main");
  visits.enter("me@x.com", "room1", "pre:0");
  expect(visits.last("me@x.com", "room1")).toBe("main");
  expect(visits.recent("me@x.com", "room1")).toEqual(["e2", "e1"]);
  visits.enter("me@x.com", "room1", "e1");
  const again = createRoomVisits(storage);
  expect(again.last("me@x.com", "room1")).toBe("e1");
  expect(again.recent("me@x.com", "room1")).toEqual(["e2", "e1"]);
  expect(again.last("other@x.com", "room1")).toBeNull();
  const broken = createRoomVisits({
    getItem: () => "{not json",
    setItem: () => {
      throw new Error("full");
    },
  });
  broken.enter("me@x.com", "room1", "e1");
  expect(broken.last("me@x.com", "room1")).toBe("e1");
});
