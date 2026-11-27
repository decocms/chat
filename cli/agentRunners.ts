// One runner per agent (agents as people, src/personas.ts): the machine's main runner runs its main agent of its own
// kind, and starts one runner for each of the machine's other agents that it can open (Claude or Codex), from the
// list that its check-in (claude_rooms) answers. It stops the runner of an agent that is gone or renamed (the name is
// in its herdr tabs), and starts again a runner that ended, after 15 s.

export type MachineAgent = {
  id: string;
  name: string;
  kind: string;
  main?: number;
};
export type Child = {
  kill(): unknown;
  on(event: "exit", run: () => void): unknown;
};

const RUNS = new Set(["claude", "codex"]);
const ID = /^p_[a-f0-9]{32}$/;

export function createAgentRunners(opts: {
  /** The kind the main runner opens. */
  kind: string;
  start(agent: MachineAgent): Child;
  log(line: string): void;
  later?: (run: () => void, ms: number) => void;
}) {
  const later = opts.later ?? ((run, ms) => setTimeout(run, ms).unref?.());
  const runners = new Map<
    string,
    { name: string; kind: string; child: Child | null; stop: boolean }
  >();
  return {
    /** The machine's agents now (undefined = an older server: nothing changes). */
    sync(list: MachineAgent[] | undefined) {
      if (!list) return;
      const mine = list.find((a) => a.main && a.kind === opts.kind);
      const want = new Map(
        list
          .filter((a) => a !== mine && RUNS.has(a.kind) && ID.test(a.id))
          .map((a) => [a.id, a]),
      );
      for (const [id, r] of runners) {
        const w = want.get(id);
        if (w && w.name === r.name && w.kind === r.kind) continue;
        r.stop = true;
        try {
          r.child?.kill();
        } catch {}
        runners.delete(id);
        opts.log(
          `stopped the runner of @${r.name}${w ? " (changed)" : " (removed)"}`,
        );
      }
      for (const [id, a] of want) {
        if (runners.has(id)) continue;
        const r = {
          name: a.name,
          kind: a.kind,
          child: null as Child | null,
          stop: false,
        };
        const start = () => {
          if (r.stop) return;
          r.child = opts.start(a);
          r.child.on("exit", () => later(start, 15_000));
        };
        runners.set(id, r);
        start();
        opts.log(`started a runner for @${a.name} (${a.kind})`);
      }
    },
    /** The agents with a runner now. */
    running: () => [...runners.keys()],
    stopAll() {
      for (const r of runners.values()) {
        r.stop = true;
        try {
          r.child?.kill();
        } catch {}
      }
      runners.clear();
    },
  };
}
