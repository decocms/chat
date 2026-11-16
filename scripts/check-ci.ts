import { availableParallelism } from "node:os";
import project from "../package.json";

// CI reports every independent gate in one run. Local `bun run check` keeps its
// fast failure behavior; the package script remains the single list of gates.
// The first gate (build:api-types) writes what the others read, so it runs
// alone; the rest run side by side, a few at a time, and their output is
// printed grouped, in the package script's order, once each has finished.
const commands = project.scripts.check.split(/\s*&&\s*/).map((command) => {
  const match = /^bun run ([\w:.-]+)$/.exec(command);
  const name = match?.[1];
  if (!name) throw new Error(`Unsupported check command: ${command}`);
  return name;
});

type Result = { name: string; code: number; output: string; ms: number };
async function run(name: string): Promise<Result> {
  const started = performance.now();
  const child = Bun.spawn(["bun", "run", name], {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return {
    name,
    code,
    output: out + err,
    ms: performance.now() - started,
  };
}
function report({ name, code, output, ms }: Result) {
  console.info(
    `::group::${code === 0 ? "PASS" : "FAIL"} ${name} (${(ms / 1000).toFixed(1)}s)`,
  );
  if (output) console.info(output.trimEnd());
  console.info("::endgroup::");
}

const [first, ...rest] = commands;
const results: Result[] = [];
if (first) {
  const result = await run(first);
  report(result);
  results.push(result);
}
const limit = Math.max(2, Math.min(4, availableParallelism()));
const done = new Map<string, Result>();
let next = 0;
await Promise.all(
  Array.from({ length: Math.min(limit, rest.length) }, async () => {
    while (next < rest.length) {
      const name = rest[next++]!;
      done.set(name, await run(name));
    }
  }),
);
for (const name of rest) {
  const result = done.get(name)!;
  report(result);
  results.push(result);
}
for (const { name, code } of results)
  console.info(`${code === 0 ? "PASS" : "FAIL"} ${name} (${code})`);
if (results.some(({ code }) => code !== 0)) process.exitCode = 1;
