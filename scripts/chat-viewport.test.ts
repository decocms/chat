import { expect, test } from "bun:test";
import type { Room, Message } from "../shared/room";
import type { RoomCommand } from "../shared/commands";
import { createChatPresentation } from "../web/features/chat-viewport/presentation";
import {
  createChatViewport,
  type ChatViewport,
  type ChatSurface,
  type KeepChat,
} from "../web/features/chat-viewport/controller";
const message = (id: number): Message => ({
  id,
  thread: "main",
  text: String(id),
  author: "a@test",
  ts: id,
});
const room = (count = 120): Room => ({
  id: "aaaaaa",
  me: "a@test",
  book: { title: "Room", owner: "a@test" },
  members: ["a@test"],
  epics: [{ id: "other", title: "Other", tasks: [] }],
  messages: Array.from({ length: count }, (_, index) => message(index + 1)),
  typing: {},
  online: [],
  suggestions: [],
});
function clock() {
  let id = 0;
  const timers = new Map<number, () => void>();
  return {
    schedule(callback: () => void) {
      const token = ++id;
      timers.set(token, callback);
      return token;
    },
    cancel(value: unknown) {
      if (typeof value === "number") timers.delete(value);
    },
    flush() {
      for (const [key, callback] of [...timers])
        if (timers.delete(key)) callback();
    },
    queued() {
      return timers.size;
    },
  };
}
function harness(count = 120) {
  let current = true,
    queued = true,
    draw = false,
    value = room(count),
    selected = "main",
    generation = 1,
    scroll = () => {},
    growth = () => {},
    revealHook = () => {},
    centered = true,
    listeners = 0;
  const time = clock(),
    commands: RoomCommand[] = [],
    renders: KeepChat[] = [],
    notices: string[] = [],
    revealed: number[] = [],
    highlighted: number[] = [],
    instant: number[] = [],
    visible = new Set<number>();
  const metrics = { top: 900, height: 1000, client: 100 };
  const surface: ChatSurface = {
    connected: () => current,
    metrics: () => ({ ...metrics }),
    top(next) {
      metrics.top = Math.max(
        0,
        Math.min(next, metrics.height - metrics.client),
      );
    },
    message(id) {
      return visible.has(id)
        ? {
            reveal(now) {
              (now ? instant : revealed).push(id);
              revealHook();
            },
            highlight() {
              highlighted.push(id);
            },
            centered: () => centered,
          }
        : null;
    },
    listen(onScroll, onGrowth) {
      listeners++;
      scroll = onScroll;
      growth = onGrowth;
      return () => {
        listeners--;
      };
    },
  };
  let view: ChatViewport;
  view = createChatViewport({
    current: () => current,
    send(command) {
      commands.push(command);
      return queued;
    },
    render(keep) {
      renders.push(keep);
      if (draw) {
        visible.clear();
        for (const item of view.selection().list) visible.add(item.id);
      }
    },
    selectThread(thread) {
      selected = thread;
      view.sync(value, selected, generation, true);
      view.attach(surface);
    },
    notice(kind) {
      notices.push(kind);
    },
    schedule: time.schedule,
    cancel: time.cancel,
  });
  view.sync(value, selected, generation, true);
  view.attach(surface);
  return {
    view,
    time,
    commands,
    renders,
    notices,
    revealed,
    highlighted,
    instant,
    visible,
    centered(next: boolean) {
      centered = next;
    },
    metrics,
    surface,
    scroll: () => scroll(),
    growth: () => growth(),
    captureGrowth: () => growth,
    onReveal(callback: () => void) {
      revealHook = callback;
    },
    draw(next: boolean) {
      draw = next;
    },
    listeners: () => listeners,
    current(next: boolean) {
      current = next;
    },
    queued(next: boolean) {
      queued = next;
    },
    sync(
      next: Room,
      fresh = false,
      thread = selected,
      nextGeneration = generation,
    ) {
      value = next;
      selected = thread;
      generation = nextGeneration;
      view.sync(value, selected, generation, true, fresh);
      view.attach(surface);
    },
  };
}
test("window grows sixty locally then requests actual older boundary, preserving privacy-filtered selection", () => {
  const h = harness();
  expect(h.view.selection().list).toHaveLength(60);
  expect(h.view.selection().list[0]?.id).toBe(61);
  h.view.loadOlder();
  expect(h.view.selection().list).toHaveLength(120);
  expect(h.commands).toHaveLength(0);
  h.view.loadOlder();
  expect(h.commands).toEqual([{ t: "older", thread: "main", before: 1 }]);
  h.view.dispose();
});
test("fresh partial snapshot invalidates completed history and permits one initial fill", () => {
  const h = harness(5);
  h.view.ensureFilled();
  h.view.ensureFilled();
  expect(h.commands).toHaveLength(1);
  h.view.older({ t: "older", thread: "main", messages: [], more: false });
  h.view.ensureFilled();
  expect(h.commands).toHaveLength(1);
  h.sync(room(5), true);
  h.view.ensureFilled();
  h.view.ensureFilled();
  expect(h.commands).toHaveLength(2);
  h.view.dispose();
});
test("prepend anchoring preserves location, growth pins only at bottom, and upward scroll unpins", () => {
  const h = harness();
  const before = h.view.capture();
  h.metrics.height = 1300;
  h.view.afterRender(true, before);
  expect(h.metrics.top).toBe(1200);
  h.metrics.height = 1500;
  h.growth();
  expect(h.metrics.top).toBe(1400);
  h.metrics.top = 400;
  h.scroll();
  expect(h.view.pinned()).toBe(false);
  h.metrics.height = 1700;
  h.growth();
  expect(h.metrics.top).toBe(400);
  const reading = h.view.capture();
  h.metrics.height = 1800;
  h.view.afterRender("stay", reading);
  expect(h.metrics.top).toBe(400);
  h.metrics.top = 1700;
  h.scroll();
  expect(h.view.pinned()).toBe(true);
  h.view.dispose();
});
test("content growth moving the bottom does not itself unpin the reader", () => {
  const h = harness();
  h.metrics.height = 1500;
  h.scroll();
  expect(h.view.pinned()).toBe(true);
  h.growth();
  expect(h.metrics.top).toBe(1400);
  h.view.dispose();
});
test("message search performs at most fifteen readonly pages and reports not found", () => {
  const h = harness(5);
  h.view.go(5000);
  for (let index = 0; index < 15; index++)
    h.view.older({ t: "older", thread: "main", messages: [], more: true });
  expect(h.commands).toHaveLength(15);
  expect(h.notices.at(-1)).toBe("missing");
  h.view.dispose();
});
test("late message reveal and deferred attention cannot cross connection/account replacement", () => {
  const h = harness(5);
  h.view.go(5000);
  const next = { ...room(5), messages: [...room(5).messages, message(5000)] };
  h.sync(next);
  h.view.older({
    t: "older",
    thread: "main",
    messages: [message(5000)],
    more: false,
  });
  h.visible.add(5000);
  let attention = 0;
  h.view.defer(() => attention++, 400);
  h.sync({ ...room(5), me: "b@test", members: ["b@test"] }, false, "main", 2);
  h.time.flush();
  expect(h.revealed).toEqual([]);
  expect(attention).toBe(0);
  expect(h.listeners()).toBe(1);
  h.view.dispose();
  expect(h.listeners()).toBe(0);
});
test("refused or missing page releases ownership for explicit retry without automatic resends", () => {
  const h = harness(5);
  h.queued(false);
  h.view.go(999);
  expect(h.notices.at(-1)).toBe("offline");
  h.queued(true);
  h.view.go(999);
  expect(h.commands).toHaveLength(2);
  h.time.flush();
  expect(h.commands).toHaveLength(2);
  expect(h.notices.at(-1)).toBe("offline");
  h.view.go(999);
  expect(h.commands).toHaveLength(3);
  h.view.dispose();
});
test("thread switch cancels old pending reads and detached observer callbacks remain inert", () => {
  const h = harness(5);
  h.view.ensureFilled();
  const oldGrowth = h.captureGrowth();
  h.sync(room(5), false, "other");
  h.view.ensureFilled();
  expect(h.commands.at(-1)).toEqual({ t: "older", thread: "other", before: 0 });
  h.view.dispose();
  const before = h.metrics.top;
  oldGrowth();
  h.time.flush();
  expect(h.metrics.top).toBe(before);
  expect(h.listeners()).toBe(0);
});
test("loaded off-window message expands only as needed then reveals/highlights and unpins", () => {
  const h = harness();
  h.draw(true);
  h.view.go(1);
  expect(h.view.selection().list).toHaveLength(120);
  expect(h.revealed).toEqual([1]);
  expect(h.highlighted).toEqual([1]);
  expect(h.view.pinned()).toBe(false);
  expect(h.commands).toHaveLength(0);
  h.view.dispose();
});
test("old render captures and canonical nonmember data cannot affect a replacement viewport", () => {
  const h = harness();
  const old = h.view.capture();
  h.sync({ ...room(), id: "bbbbbb" }, false, "main", 2);
  h.metrics.top = 333;
  h.view.afterRender(undefined, old);
  expect(h.metrics.top).toBe(333);
  h.sync({ ...room(), members: [] });
  expect(h.view.selection().list).toEqual([]);
  h.view.go(999);
  h.growth();
  expect(h.commands).toEqual([]);
  expect(h.listeners()).toBe(0);
  h.view.dispose();
});
test("reentrant navigation from reveal does not highlight old content or cancel a new message intent", () => {
  const h = harness();
  h.visible.add(1);
  h.onReveal(() => {
    h.sync({ ...room(5), id: "bbbbbb" }, false, "main", 2);
    h.view.go(999);
  });
  h.view.go(1);
  h.view.go(999);
  expect(h.highlighted).toEqual([]);
  expect(h.notices.filter((kind) => kind === "searching")).toHaveLength(1);
  h.view.dispose();
});
test("refused or timed-out initial fill is not resent by passive renders; explicit retry queues one read", () => {
  for (const timeout of [false, true]) {
    const h = harness(5);
    h.queued(timeout);
    h.view.ensureFilled();
    if (timeout) h.time.flush();
    expect(h.notices.at(-1)).toBe("offline");
    h.queued(true);
    for (let index = 0; index < 4; index++) {
      h.sync(room(5));
      h.view.ensureFilled();
    }
    expect(h.commands).toHaveLength(1);
    h.view.loadOlder();
    h.view.ensureFilled();
    expect(h.commands).toHaveLength(2);
    h.view.dispose();
  }
});
test("empty failed initial history exposes the existing older control and explicit retry uses before zero", () => {
  const h = harness(0);
  h.queued(false);
  h.view.ensureFilled();
  expect(h.view.selection().more).toBe(true);
  h.time.flush();
  expect(h.renders.at(-1)).toBe("stay");
  h.view.ensureFilled();
  expect(h.commands).toHaveLength(1);
  h.queued(true);
  h.view.loadOlder();
  expect(h.commands).toEqual([
    { t: "older", thread: "main", before: 0 },
    { t: "older", thread: "main", before: 0 },
  ]);
  h.view.dispose();
});

test("Board hide, hidden frame growth, and pre-flush show preserve the visible unpinned reading anchor", () => {
  const h = harness(),
    presentation = createChatPresentation(h.view);
  let hidden = false;
  h.surface.connected = () => !hidden;
  h.metrics.top = 300;
  h.scroll();
  expect(h.view.pinned()).toBe(false);
  presentation.capture("stay", true);
  presentation.capture("stay", false); // Board state changes before CSS flush.
  hidden = true;
  h.metrics.top = 0;
  h.metrics.height = 0;
  h.metrics.client = 0;
  h.sync(room(121));
  h.growth();
  presentation.capture("stay", false);
  expect(presentation.rendered(false)).toBe(false);
  presentation.capture("stay", true); // Chat state changes while its DOM is still hidden.
  hidden = false;
  h.metrics.height = 1400;
  h.metrics.client = 100;
  expect(presentation.rendered(true)).toBe(true);
  expect(h.metrics.top).toBe(300);
  expect(h.view.pinned()).toBe(false);
  h.view.dispose();
});

test("hidden new-message bottom intent survives passive Board renders until chat becomes visible", () => {
  const h = harness(),
    presentation = createChatPresentation(h.view);
  let hidden = false;
  h.surface.connected = () => !hidden;
  presentation.capture("stay", true);
  presentation.capture("stay", false);
  hidden = true;
  h.metrics.top = 0;
  h.metrics.height = 0;
  h.metrics.client = 0;
  presentation.capture(undefined, false);
  presentation.capture("stay", false);
  presentation.capture("stay", true);
  hidden = false;
  h.metrics.height = 1400;
  h.metrics.client = 100;
  presentation.rendered(true);
  // DOM scrollTop clamps at scrollHeight - clientHeight, although the owner
  // requests scrollHeight to stay pinned through late content growth.
  expect(h.metrics.top).toBe(h.metrics.height - h.metrics.client);
  expect(h.view.pinned()).toBe(true);
  h.view.dispose();
});

test("real selection append cannot replace a row of an unpinned hidden Board reading window", () => {
  const h = harness(),
    presentation = createChatPresentation(h.view);
  let hidden = false;
  h.surface.connected = () => !hidden;
  h.metrics.top = 300;
  h.scroll();
  const before = h.view.selection().list.map((item) => item.id),
    anchorId = 100;
  const beforeY = before.indexOf(anchorId) * 10 - h.metrics.top;
  presentation.capture("stay", true);
  // A manual scroll since the preceding projection must be captured at the
  // pre-hide state publication, while the actual DOM geometry is still visible.
  h.metrics.top = 320;
  h.scroll();
  presentation.capture("stay", false);
  hidden = true;
  h.metrics.top = 0;
  h.metrics.height = 0;
  h.metrics.client = 0;
  h.sync(room(121));
  presentation.capture("stay", false);
  expect(h.view.selection().list.map((item) => item.id)).toEqual(before);
  expect(h.view.selection().list).toHaveLength(60);
  presentation.capture("stay", true);
  hidden = false;
  h.metrics.height = 1000;
  h.metrics.client = 100;
  presentation.rendered(true);
  expect(h.metrics.top).toBe(320);
  const afterY =
    h.view.selection().list.findIndex((item) => item.id === anchorId) * 10 -
    h.metrics.top;
  expect(afterY).toBe(beforeY - 20);
  h.metrics.top = h.metrics.height - h.metrics.client;
  h.scroll();
  expect(h.view.selection().list.at(-1)?.id).toBe(121);
  expect(h.view.selection().list).toHaveLength(60);
  expect(h.view.pinned()).toBe(true);
  h.view.dispose();
});

test("unpinned incoming bursts keep sixty rows; explicit latest and deep links include new targets", () => {
  const h = harness();
  h.metrics.top = 300;
  h.scroll();
  const retained = h.view.selection().list.map((item) => item.id);
  h.sync(room(600));
  expect(h.view.selection().list.map((item) => item.id)).toEqual(retained);
  expect(h.view.selection().list).toHaveLength(60);
  h.view.followLatest();
  expect(h.view.selection().list).toHaveLength(60);
  expect(h.view.selection().list.at(-1)?.id).toBe(600);
  expect(h.view.pinned()).toBe(true);
  h.metrics.top = 200;
  h.scroll();
  h.sync(room(601));
  h.draw(true);
  h.view.go(601);
  expect(h.revealed.at(-1)).toBe(601);
  expect(h.view.selection().list.at(-1)?.id).toBe(601);
  expect(h.view.selection().list).toHaveLength(60);
  expect(h.commands).toEqual([]);
  h.view.dispose();
});

test("older expands before the retained end, and new tail rows do not masquerade as older history", () => {
  const h = harness();
  h.sync({ ...room(), complete: true });
  h.metrics.top = 300;
  h.scroll();
  h.sync({ ...room(200), complete: true });
  h.view.loadOlder();
  const selected = h.view.selection();
  expect(selected.list).toHaveLength(120);
  expect(selected.list[0]?.id).toBe(1);
  expect(selected.list.at(-1)?.id).toBe(120);
  expect(selected.more).toBe(false);
  h.view.loadOlder();
  expect(h.view.selection().list).toEqual(selected.list);
  expect(h.commands).toEqual([]);
  h.sync({ ...room(200), id: "bbbbbb" }, false, "main", 2);
  expect(h.view.selection().list).toHaveLength(60);
  expect(h.view.selection().list.at(-1)?.id).toBe(200);
  expect(h.view.pinned()).toBe(true);
  h.view.dispose();
});

test("force-bottom completion releases an end refrozen by intervening scroll before the render flush", () => {
  const h = harness();
  h.metrics.top = 300;
  h.scroll();
  h.sync(room(121));
  h.view.followLatest();
  h.metrics.top = 200;
  h.scroll();
  expect(h.view.pinned()).toBe(false);
  h.view.afterRender(undefined, h.view.capture());
  expect(h.view.pinned()).toBe(true);
  h.sync(room(122));
  expect(h.view.selection().list.at(-1)?.id).toBe(122);
  expect(h.view.selection().list).toHaveLength(60);
  h.view.dispose();
});

const inThread = (id: number, thread: string): Message => ({
  ...message(id),
  thread,
});
test("a jump to a loaded message owns the scroll until it lands: a late scroll at the bottom does not pull it back", () => {
  const h = harness();
  h.draw(true);
  h.view.go(100);
  expect(h.revealed).toEqual([100]);
  expect(h.highlighted).toEqual([100]);
  expect(h.view.pinned()).toBe(false);
  // The scroll event of the position before the jump (still at the bottom) arrives after the smooth scroll began.
  const renders = h.renders.length;
  h.metrics.top = 900;
  h.scroll();
  expect(h.view.pinned()).toBe(false);
  expect(h.renders).toHaveLength(renders);
  h.growth();
  expect(h.metrics.top).toBe(900);
  // A render that holds the reader's place would write scrollTop and cancel the smooth scroll.
  const before = h.view.capture();
  h.metrics.top = 500;
  h.view.afterRender("stay", before);
  expect(h.metrics.top).toBe(500);
  // Near the top of the history, the scroll-back waits too.
  h.metrics.top = 20;
  h.scroll();
  expect(h.commands).toHaveLength(0);
  // Landed off the middle (something moved it): centered at once.
  h.centered(false);
  h.time.flush();
  expect(h.instant).toEqual([100]);
  // After landing, the chat behaves as before: reaching the bottom pins it.
  h.metrics.top = 900;
  h.scroll();
  expect(h.view.pinned()).toBe(true);
  h.view.dispose();
});
test("a jump that lands centered is left alone, and an own send ends the jump", () => {
  const h = harness();
  h.draw(true);
  h.view.go(100);
  h.time.flush();
  expect(h.instant).toEqual([]);
  h.view.go(90);
  h.view.followLatest();
  h.centered(false);
  h.time.flush();
  expect(h.instant).toEqual([]);
  expect(h.view.pinned()).toBe(true);
  h.view.dispose();
});
test("a quote in another thread switches to it, loads its history and then reveals the message", () => {
  const h = harness(5);
  h.view.go(7, "other");
  expect(h.commands.at(-1)).toEqual({ t: "older", thread: "other", before: 0 });
  expect(h.notices.at(-1)).toBe("searching");
  const quoted = inThread(7, "other");
  h.sync({ ...room(5), messages: [...room(5).messages, quoted] });
  h.view.older({
    t: "older",
    thread: "other",
    messages: [quoted],
    more: false,
  });
  h.visible.add(7);
  h.time.flush();
  expect(h.revealed).toEqual([7]);
  expect(h.highlighted).toEqual([7]);
  expect(h.view.pinned()).toBe(false);
  h.view.dispose();
});
test("a quote not loaded in this thread pages back until it is found, then reveals it", () => {
  const h = harness(0);
  const recent = Array.from({ length: 5 }, (_, index) => message(50 + index));
  h.sync({ ...room(0), messages: recent });
  h.view.go(10);
  expect(h.commands.at(-1)).toEqual({ t: "older", thread: "main", before: 50 });
  const first = Array.from({ length: 30 }, (_, index) => message(20 + index));
  h.sync({ ...room(0), messages: [...first, ...recent] });
  h.view.older({ t: "older", thread: "main", messages: first, more: true });
  expect(h.commands.at(-1)).toEqual({ t: "older", thread: "main", before: 20 });
  const second = Array.from({ length: 10 }, (_, index) => message(10 + index));
  h.sync({ ...room(0), messages: [...second, ...first, ...recent] });
  h.view.older({ t: "older", thread: "main", messages: second, more: true });
  h.draw(true);
  h.time.flush();
  expect(h.revealed).toEqual([10]);
  expect(h.highlighted).toEqual([10]);
  expect(h.commands).toHaveLength(2);
  h.view.dispose();
});
