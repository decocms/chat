// Playback ownership/operations only: no Svelte compiler or real CSS geometry.
import { afterAll, afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import {
  createRoomPlayback,
  type RoomAnimation,
} from "../svelte/features/room-layout/playback";
const environment = new Window();
const names = [
  "document",
  "Animation",
  "KeyframeEffect",
  "CSSAnimation",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "performance",
] as const;
const originals = names.map(
  (name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
);
let now = 0,
  frameId = 0;
const frames = new Map<number, FrameRequestCallback>();
for (const [name, value] of [
  ["document", environment.document],
  ["Animation", environment.Animation],
  ["KeyframeEffect", environment.KeyframeEffect],
] as const)
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
Object.defineProperty(globalThis, "performance", {
  value: { now: () => now },
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, "requestAnimationFrame", {
  value: (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  },
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, "cancelAnimationFrame", {
  value: (id: number) => {
    frames.delete(id);
  },
  configurable: true,
  writable: true,
});
class ControlledAnimation extends Animation {
  readonly animationName: RoomAnimation;
  pauses = 0;
  writes = 0;
  state: AnimationPlayState = "running";
  pendingTask = false;
  private time: Animation["currentTime"] = null;
  constructor(target: Element, name: RoomAnimation = "vb-room-viewport") {
    super(new KeyframeEffect(target, [], { duration: 1000 }));
    this.animationName = name;
  }
  override get playState() {
    return this.state;
  }
  override get pending() {
    return this.pendingTask;
  }
  override pause() {
    this.pauses++;
    this.state = "paused";
    this.pendingTask = true;
  }
  override get currentTime() {
    return this.time;
  }
  override set currentTime(value: Animation["currentTime"]) {
    this.writes++;
    this.time = value;
    this.pendingTask = false;
  }
}
Object.defineProperty(globalThis, "CSSAnimation", {
  value: ControlledAnimation,
  configurable: true,
  writable: true,
});
const owners: ReturnType<typeof createRoomPlayback>[] = [];
afterEach(() => {
  for (const owner of owners.splice(0)) owner.dispose();
  document.body.replaceChildren();
  frames.clear();
  now = 0;
});
afterAll(() => {
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});
function fixture() {
  const target = document.createElement("div");
  document.body.append(target);
  let animations: Animation[] = [],
    finds = 0,
    unavailable = 0;
  let expected: RoomAnimation = "vb-room-viewport";
  target.getAnimations = () => {
    finds++;
    return animations;
  };
  const owner = createRoomPlayback(
    target,
    () => expected,
    () => {
      unavailable++;
    },
  );
  owners.push(owner);
  return {
    target,
    owner,
    animation: (name?: RoomAnimation) => new ControlledAnimation(target, name),
    show: (...values: Animation[]) => {
      animations = values;
    },
    expectName: (name: RoomAnimation) => {
      expected = name;
    },
    counts: () => ({ finds, unavailable }),
  };
}
function tick(time = now + 16) {
  now = time;
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) callback(now);
}
test("same progress re-discovers every time but does not pause or seek an already correct animation", () => {
  const f = fixture(),
    first = f.animation();
  f.show(first);
  f.owner.set(0.4);
  expect([first.pauses, first.writes, first.currentTime]).toEqual([1, 1, 400]);
  f.owner.set(0.4);
  expect(f.counts().finds).toBe(2);
  expect([first.pauses, first.writes]).toEqual([1, 1]);
  const replacement = f.animation();
  replacement.state = "paused";
  replacement.currentTime = 0;
  replacement.writes = 0;
  f.show(replacement);
  f.owner.set(0.4);
  expect(f.counts().finds).toBe(3);
  expect(replacement.currentTime).toBe(400);
  expect(replacement.writes).toBe(1);
  expect([first.pauses, first.writes]).toEqual([1, 1]);
});
test("externally resumed or changed time is corrected despite unchanged requested progress", () => {
  const f = fixture(),
    animation = f.animation();
  f.show(animation);
  f.owner.set(0.5);
  animation.state = "running";
  f.owner.set(0.5);
  expect(animation.pauses).toBe(2);
  expect(animation.writes).toBe(2);
  animation.currentTime = 7;
  const writes = animation.writes;
  f.owner.set(0.5);
  expect(animation.currentTime).toBe(500);
  expect(animation.writes).toBe(writes + 1);
  f.owner.set(0.25);
  expect(animation.currentTime).toBe(250);
});
test("finite clamping and invalid inputs preserve the previous requested position without discovery", () => {
  const f = fixture(),
    animation = f.animation();
  f.show(animation);
  f.owner.set(2);
  expect(animation.currentTime).toBe(1000);
  const before = f.counts().finds;
  for (const value of [NaN, Infinity, -Infinity]) f.owner.set(value);
  expect(f.counts().finds).toBe(before);
  expect(animation.currentTime).toBe(1000);
  f.owner.set(-1);
  expect(animation.currentTime).toBe(0);
});
test("discovery ignores wrong names and foreign targets, then seeks a new correct animation in its queued retry", () => {
  const f = fixture(),
    wrongName = f.animation("vb-room-sheet"),
    foreign = new ControlledAnimation(document.createElement("div"));
  f.show(wrongName, foreign);
  f.owner.set(0.6);
  expect(frames.size).toBe(1);
  expect(wrongName.writes).toBe(0);
  expect(foreign.writes).toBe(0);
  const correct = f.animation();
  f.show(correct);
  tick();
  expect(correct.currentTime).toBe(600);
  expect(frames.size).toBe(0);
  expect(f.counts().unavailable).toBe(0);
  const rail = f.animation("vb-room-document-width-rail");
  f.expectName("vb-room-document-width-rail");
  f.show(rail);
  f.owner.set(0.6);
  expect(rail.currentTime).toBe(600);
});
test("suspend cancels old discovery and explicit retry uses the newest requested position", () => {
  const f = fixture();
  f.owner.set(0.4);
  const abandoned = [...frames.values()][0]!;
  f.owner.suspend();
  expect(frames.size).toBe(0);
  const animation = f.animation();
  f.show(animation);
  abandoned(16);
  expect(animation.writes).toBe(0);
  f.owner.set(0.8);
  expect(animation.currentTime).toBe(800);
});
test("unavailable discovery is bounded; dispose and disconnected owners cannot seek or notify late", () => {
  const f = fixture();
  f.owner.set(0.4);
  tick(30001);
  expect(f.counts().unavailable).toBe(1);
  expect(frames.size).toBe(0);
  f.owner.set(0.7);
  const pending = [...frames.values()][0]!;
  f.owner.dispose();
  const animation = f.animation();
  f.show(animation);
  pending(30002);
  f.owner.set(0.7);
  expect(animation.writes).toBe(0);
  expect(f.counts().unavailable).toBe(1);
  const disconnected = fixture();
  disconnected.target.remove();
  disconnected.owner.set(0.4);
  expect(frames.size).toBe(0);
  expect(disconnected.counts()).toEqual({ finds: 0, unavailable: 0 });
});

test("a pending pause at the wanted time is completed by a currentTime write", () => {
  const f = fixture(),
    animation = f.animation();
  f.show(animation);
  f.owner.set(0.5);
  const writes = animation.writes;
  animation.pendingTask = true;
  f.owner.set(0.5);
  expect(animation.writes).toBe(writes + 1);
  expect(animation.pending).toBe(false);
  f.owner.set(0.5);
  expect(animation.writes).toBe(writes + 1);
});
