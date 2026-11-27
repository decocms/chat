// One runner per agent (cli/agentRunners.ts): the main runner starts a runner for each other agent of its machine,
// stops the ones that are gone or changed, and starts again one that ended.
import { expect, test } from "bun:test";
import { createAgentRunners, type MachineAgent } from "../cli/agentRunners";

const id = (c: string) => `p_${c.repeat(32)}`;
function world(kind = "claude") {
  const started: string[] = [],
    killed: string[] = [],
    timers: (() => void)[] = [];
  const exits = new Map<string, () => void>();
  const r = createAgentRunners({
    kind,
    start: (a) => {
      started.push(a.name);
      return {
        kill: () => killed.push(a.name),
        on: (_: "exit", run: () => void) => exits.set(a.name, run),
      };
    },
    log: () => {},
    later: (run) => timers.push(run),
  });
  return { r, started, killed, timers, exits };
}

const main: MachineAgent = {
  id: id("a"),
  name: "claude",
  kind: "claude",
  main: 1,
};
const codex: MachineAgent = {
  id: id("b"),
  name: "reviewer",
  kind: "codex",
  main: 0,
};
const second: MachineAgent = {
  id: id("c"),
  name: "claude-2",
  kind: "claude",
  main: 0,
};

test("the main agent of its kind is the main runner's own; each other agent gets a runner", () => {
  const w = world();
  w.r.sync([main, codex, second]);
  expect(w.started).toEqual(["reviewer", "claude-2"]);
  // The same list again: nothing new.
  w.r.sync([main, codex, second]);
  expect(w.started).toEqual(["reviewer", "claude-2"]);
});

test("Antigravity and OpenCode get no runner yet; an older server sends no list", () => {
  const w = world();
  w.r.sync(undefined);
  w.r.sync([
    main,
    { id: id("d"), name: "agy", kind: "agy" },
    { id: id("e"), name: "oc", kind: "opencode" },
  ]);
  expect(w.started).toEqual([]);
});

test("a Codex main runner runs a Claude main agent in its own runner", () => {
  const w = world("codex");
  w.r.sync([main, codex]);
  expect(w.started).toEqual(["claude", "reviewer"]);
});

test("a removed or renamed agent's runner stops; a renamed one starts again with its new name", () => {
  const w = world();
  w.r.sync([main, codex, second]);
  w.r.sync([main, { ...codex, name: "boss" }]);
  expect(w.killed).toEqual(["reviewer", "claude-2"]);
  expect(w.started).toEqual(["reviewer", "claude-2", "boss"]);
  expect(w.r.running()).toEqual([codex.id]);
});

test("a runner that ended starts again after a while; a stopped one does not", () => {
  const w = world();
  w.r.sync([main, codex]);
  w.exits.get("reviewer")!();
  expect(w.timers).toHaveLength(1);
  w.timers.shift()!();
  expect(w.started).toEqual(["reviewer", "reviewer"]);
  w.r.stopAll();
  w.exits.get("reviewer")!();
  w.timers.shift()!();
  expect(w.started).toEqual(["reviewer", "reviewer"]);
});
