import { expect, test } from "bun:test";
import { get } from "svelte/store";
import { createPersonalSession } from "../web/features/home/personal";
import { createRoomsSession } from "../web/features/rooms/session";
import { createAppNavigationSession } from "../web/features/app-navigation/controller";
import { createNavigationPresentation } from "../web/features/app-navigation/presentation";
import {
  deferred,
  homeApi,
  manualClock,
  me,
  room,
  settle,
} from "./home-fixtures";

async function fixture() {
  const timer = manualClock();
  let canonical = me({ books: [room("aaaaaa"), room("bbbbbb")] });
  const personal = createPersonalSession(
    homeApi({ me: async () => canonical }),
    { clock: timer.clock },
  );
  await personal.refresh();
  const rooms = createRoomsSession(personal, timer.clock);
  const controller = createAppNavigationSession(
    personal,
    rooms,
    { navigate() {}, home() {}, archived() {} },
    timer.clock,
  );
  const late = deferred<{ name: string }>();
  let loads = 0;
  const presentation = createNavigationPresentation(
    controller,
    () => {
      loads++;
      return late.promise;
    },
    timer.clock,
  );
  return {
    personal,
    controller,
    presentation,
    late,
    loads: () => loads,
    replace(email: string) {
      canonical = me({ email });
      personal.acceptIdentity(email);
      return personal.refresh();
    },
    dispose() {
      presentation.dispose();
      controller.dispose();
      rooms.dispose();
      personal.dispose();
    },
  };
}

test("closed navigation does not fetch presentation; late module cannot reopen a cancelled intent", async () => {
  const h = await fixture();
  try {
    await settle();
    expect(h.loads()).toBe(0);
    h.controller.openSearch();
    await settle();
    const intent = get(h.presentation.state)!;
    expect(intent.kind).toBe("search");
    expect(h.loads()).toBe(1);
    h.presentation.close(intent);
    h.late.resolve({ name: "dialogs" });
    await settle();
    expect(get(h.presentation.state)).toBeNull();
    expect(get(h.controller.search.state).open).toBe(false);
    expect(h.presentation.owns(intent)).toBe(false);
    expect(get(h.presentation.module.state).phase).toBe("ready");
  } finally {
    h.dispose();
  }
});

test("queued old close cannot cancel a new intent before DOM flush; loaded module identity remains stable", async () => {
  const h = await fixture();
  try {
    h.controller.openSearch();
    const old = get(h.presentation.state)!;
    h.controller.search.close();
    h.controller.openCreate();
    const current = get(h.presentation.state)!;
    expect(current.kind).toBe("create");
    h.presentation.close(old);
    expect(get(h.controller.creator.state).open).toBe(true);
    const component = { name: "dialogs" };
    h.late.resolve(component);
    await settle();
    const loaded = get(h.presentation.module.state);
    expect(loaded.phase).toBe("ready");
    if (loaded.phase === "ready") expect(loaded.component).toBe(component);
    h.presentation.close(current);
    h.controller.openSearch();
    await settle();
    expect(h.loads()).toBe(1);
  } finally {
    h.dispose();
  }
});

test("account replacement fences old pending closes and focus references without discarding the current intent", async () => {
  const h = await fixture();
  try {
    h.controller.openSearch();
    const old = get(h.presentation.state)!;
    await h.replace("new@example.test");
    h.controller.openSearch();
    const next = get(h.presentation.state)!;
    expect(next.account).toBe("new@example.test");
    expect(next.identityRevision).not.toBe(old.identityRevision);
    h.presentation.close(old);
    expect(get(h.controller.search.state).open).toBe(true);
    expect(h.presentation.returnFocus(old, null)).toBeNull();
    h.late.resolve({ name: "dialogs" });
    await settle();
    expect(h.presentation.owns(next)).toBe(true);
  } finally {
    h.dispose();
  }
});

test("disposal ignores a late module and releases the loader ownership predicate", async () => {
  const h = await fixture();
  h.controller.openSearch();
  await settle();
  const intent = get(h.presentation.state)!;
  h.presentation.dispose();
  h.late.resolve({ name: "late" });
  await settle();
  expect(get(h.presentation.state)).toBeNull();
  expect(h.presentation.owns(intent)).toBe(false);
  expect(get(h.presentation.module.state).phase).not.toBe("ready");
  h.dispose();
});

test("concurrent Search retains the existing Archive opening and ownership until Archive itself closes", async () => {
  const h = await fixture();
  try {
    h.controller.askArchive("aaaaaa");
    const archive = get(h.presentation.bindings).archive!;
    h.controller.openSearch();
    const search = get(h.presentation.bindings).search!;
    expect(get(h.presentation.bindings).archive).toBe(archive);
    expect(h.presentation.owns(archive)).toBe(true);
    expect(h.presentation.owns(search)).toBe(true);
    h.controller.search.edit("query update");
    expect(get(h.presentation.bindings).archive).toBe(archive);
    h.presentation.close(search);
    expect(get(h.controller.state).archiveId).toBe("aaaaaa");
    expect(get(h.presentation.bindings).archive).toBe(archive);
    expect(get(h.presentation.state)).toBe(archive);
    h.controller.closeSettings();
    h.controller.askArchive("bbbbbb");
    const replacement = get(h.presentation.bindings).archive!;
    h.presentation.close(archive);
    expect(get(h.controller.state).archiveId).toBe("bbbbbb");
    expect(h.presentation.owns(archive)).toBe(false);
    expect(h.presentation.owns(replacement)).toBe(true);
  } finally {
    h.dispose();
  }
});

test("a room's menu is not a dialog: it opens at the pointer, and Archive from it replaces it", async () => {
  const h = await fixture();
  try {
    h.controller.openMenu("aaaaaa", undefined, { x: 40, y: 80 });
    expect(get(h.controller.state).menu).toEqual({
      id: "aaaaaa",
      x: 40,
      y: 80,
    });
    expect(get(h.presentation.state)).toBeNull();
    h.controller.openMenu("nope", undefined, { x: 1, y: 1 });
    expect(get(h.controller.state).menu?.id).toBe("aaaaaa");
    h.controller.askArchive("aaaaaa");
    expect(get(h.controller.state).menu).toBeNull();
    expect(get(h.presentation.bindings).archive?.roomId).toBe("aaaaaa");
    h.controller.closeSettings();
    h.controller.openMenu("bbbbbb", undefined, { x: 0, y: 0 });
    h.controller.closeMenu();
    expect(get(h.controller.state).menu).toBeNull();
  } finally {
    h.dispose();
  }
});

test("a drop on the rail reaches the server when you also have DMs, which are not on the rail (Gimenes #4223 #4234)", async () => {
  const timer = manualClock();
  const sent: string[][] = [];
  const personal = createPersonalSession(
    homeApi({
      me: async () =>
        me({
          books: [room("aaaaaa"), room("dm1", { dm: 1 }), room("bbbbbb")],
        }),
      order: async (ids) => {
        sent.push(ids);
        return { ok: true };
      },
    }),
    { clock: timer.clock },
  );
  await personal.refresh();
  // The real rooms session: its own check also must leave the DMs out.
  const rooms = createRoomsSession(personal, timer.clock);
  const controller = createAppNavigationSession(
    personal,
    rooms,
    { navigate() {}, home() {}, archived() {} },
    timer.clock,
  );
  try {
    controller.order(["bbbbbb", "aaaaaa"]);
    await settle();
    expect(sent).toEqual([["bbbbbb", "aaaaaa"]]);
  } finally {
    controller.dispose();
    rooms.dispose();
    personal.dispose();
  }
});

test("a room moved one place leaves the DMs out of the saved order", async () => {
  const timer = manualClock();
  const sent: string[][] = [];
  const personal = createPersonalSession(
    homeApi({
      me: async () =>
        me({
          books: [room("aaaaaa"), room("dm1", { dm: 1 }), room("bbbbbb")],
        }),
      order: async (ids) => {
        sent.push(ids);
        return { ok: true };
      },
    }),
    { clock: timer.clock },
  );
  await personal.refresh();
  const rooms = createRoomsSession(personal, timer.clock);
  const controller = createAppNavigationSession(
    personal,
    rooms,
    { navigate() {}, home() {}, archived() {} },
    timer.clock,
  );
  try {
    controller.move("aaaaaa", 1);
    await settle();
    expect(sent).toEqual([["bbbbbb", "aaaaaa"]]);
  } finally {
    controller.dispose();
    rooms.dispose();
    personal.dispose();
  }
});

test("leaving the open room goes home once the server takes you out; leaving another room stays put", async () => {
  const timer = manualClock();
  let canonical = me({ books: [room("aaaaaa"), room("bbbbbb")] });
  const left: string[] = [];
  const personal = createPersonalSession(
    homeApi({
      me: async () => canonical,
      leave: async (id) => {
        left.push(id);
        canonical = me({
          books: canonical.books.filter((book) => book.id !== id),
        });
        return { ok: true };
      },
    }),
    { clock: timer.clock },
  );
  await personal.refresh();
  const rooms = createRoomsSession(personal, timer.clock);
  let homes = 0;
  const controller = createAppNavigationSession(
    personal,
    rooms,
    { navigate() {}, home: () => void homes++, archived() {} },
    timer.clock,
  );
  controller.syncPath("https://vibebook.test/b/aaaaaa");
  controller.askLeave("bbbbbb");
  expect(get(controller.state).leaveId).toBe("bbbbbb");
  await controller.confirmLeave();
  expect(homes).toBe(0);
  controller.askLeave("aaaaaa");
  await controller.confirmLeave();
  expect(left).toEqual(["bbbbbb", "aaaaaa"]);
  expect(homes).toBe(1);
  await settle();
  expect(get(personal.state).me?.books.map((book) => book.id)).toEqual([]);
  controller.dispose();
  rooms.dispose();
  personal.dispose();
});

test("company rooms: opening the list reads it again and marks the newest one shown as seen; closing drops every New", async () => {
  const timer = manualClock();
  const personal = createPersonalSession(
    homeApi({ me: async () => me({ email: "bia@deco.cx" }) }),
    { clock: timer.clock },
  );
  await personal.refresh();
  const rooms = createRoomsSession(personal, timer.clock);
  const org = (id: string, fresh: boolean, at: number) => ({
    id,
    title: id,
    icon: null,
    people: 1,
    opened_by: "ana@deco.cx",
    opened_by_name: "Ana",
    opened_at: at,
    new: fresh,
  });
  let reads = 0;
  const seen: number[] = [];
  const controller = createAppNavigationSession(
    personal,
    rooms,
    {
      navigate() {},
      home() {},
      archived() {},
      orgRooms: async () => {
        reads++;
        return {
          domain: "deco.cx",
          rooms: [
            org("bbbbbb", true, 30),
            org("cccccc", true, 20),
            org("aaaaaa", false, 10),
          ],
        };
      },
      seeOrgRooms: async (until) => {
        seen.push(until);
      },
    },
    timer.clock,
  );
  await settle();
  expect(reads).toBe(1);
  expect(get(controller.company).filter((room) => room.new)).toHaveLength(2);
  controller.openCompany();
  await settle();
  expect(reads).toBe(2);
  expect(seen).toEqual([30]);
  // Still New while the list is open.
  expect(get(controller.company).filter((room) => room.new)).toHaveLength(2);
  controller.closeCompany();
  expect(get(controller.company).some((room) => room.new)).toBe(false);
  controller.dispose();
  rooms.dispose();
  personal.dispose();
});
