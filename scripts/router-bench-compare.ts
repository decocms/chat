// Compares two router bench runs (scripts/router-bench.ts --json): main before, the pull request after
// (AGENTS.md rule 14, Gimenes #4412). Writes a Markdown table for the PR comment and exits 1 when a score goes down
// or an action says "yes" wrongly more often. A part that main does not have yet is new: it is shown, not compared.
//   bun scripts/router-bench-compare.ts base.json head.json out.md
import { readFileSync, writeFileSync } from "node:fs";

type Part = { right: number; n: number; falseYes?: number };
type Scores = { wake?: Part; actions?: Record<string, Part> };

export function compareBench(base: Scores, head: Scores) {
  const parts = (s: Scores): Record<string, Part> => ({
    ...(s.wake ? { acordar: s.wake } : {}),
    ...(s.actions ?? {}),
  });
  const before = parts(base),
    after = parts(head);
  const pct = (p?: Part) =>
    p && p.n
      ? `${p.right}/${p.n} (${Math.round((p.right / p.n) * 100)}%)`
      : "—";
  const rows: string[] = [];
  let worse = false;
  for (const name of [
    ...new Set([...Object.keys(before), ...Object.keys(after)]),
  ]) {
    const b = before[name],
      a = after[name];
    let verdict = "igual";
    if (!a) {
      verdict = "❌ sumiu";
      worse = true;
    } else if (!b) verdict = "novo";
    else {
      const rate = (p: Part) => p.right / p.n;
      const down = rate(a) < rate(b) - 1e-9,
        moreFalse = (a.falseYes ?? 0) > (b.falseYes ?? 0);
      if (down || moreFalse) {
        verdict = down ? "❌ caiu" : "❌ mais falso sim";
        worse = true;
      } else if (rate(a) > rate(b) + 1e-9) verdict = "✅ subiu";
    }
    const fy = (p?: Part) =>
      p?.falseYes === undefined ? "" : ` · falso sim ${p.falseYes}`;
    rows.push(
      `| ${name} | ${pct(b)}${fy(b)} | ${pct(a)}${fy(a)} | ${verdict} |`,
    );
  }
  const table = [
    "| Parte | main | este PR | |",
    "|---|---|---|---|",
    ...rows,
  ].join("\n");
  return {
    worse,
    markdown: `### Router bench (AGENTS.md, regra 14)\n\n${table}\n\n${worse ? "**Uma nota caiu: o check falha.**" : "Nenhuma nota caiu."}\n`,
  };
}

if (import.meta.main) {
  const [basePath, headPath, out] = process.argv.slice(2);
  const read = (p: string): Scores => JSON.parse(readFileSync(p, "utf8"));
  const { worse, markdown } = compareBench(read(basePath!), read(headPath!));
  writeFileSync(out!, markdown);
  console.log(markdown);
  if (worse) process.exit(1);
}
