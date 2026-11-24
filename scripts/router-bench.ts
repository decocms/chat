// The router's bench: every change to the router (src/router-rule.ts, src/router-jev.ts, src/routerActions.ts) runs
// against these cases and must not score worse. Two parts:
// - wake: scripts/router-cases.json (anonymized seed, in the repo) + with --d1 the ones people's agents recorded in
//   production with MCP router_feedback (D1 router_cases, read at run time, never written here).
// - actions: scripts/router-action-cases.json, each router action on messages it must and must not act on, through
//   runRouterActions with the real Jev (Gimenes #4382). A false "yes" (closing a thread nobody closed) is the costly
//   miss, so the report shows false positives apart.
//   bun scripts/router-bench.ts [--d1] [--min 0.85] [--only wake|actions]
// Needs OPENROUTER_API_KEY in .dev.vars (real Jev calls, ~US$0.00002 each).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { rule } from "../src/router-rule";
import { jev, own } from "../src/router-jev";
import { decide } from "../src/jev";
import { ROUTER_ACTIONS, runRouterActions, type ActionRoom } from "../src/routerActions";

type Case = { note?: string; own: boolean; name: string; sender: string; text: string; topic?: string; recent?: string; memory?: string; expected: "wake" | "ignore" };
const args = process.argv.slice(2), min = Number(args[args.indexOf("--min") + 1]) || 0;
// The key comes from .dev.vars, or from the shell (OPENROUTER_API_KEY) when there is no .dev.vars here.
const vars = Object.fromEntries((existsSync(".dev.vars") ? readFileSync(".dev.vars", "utf8") : `OPENROUTER_API_KEY=${process.env.OPENROUTER_API_KEY ?? ""}`).split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]));
const env = { ...vars, MODEL_JUDGE: readFileSync("wrangler.jsonc", "utf8").match(/"MODEL_JUDGE":\s*"([^"]+)"/)?.[1] } as never;
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : "";
const cases: Case[] = only === "actions" ? [] : JSON.parse(readFileSync("scripts/router-cases.json", "utf8"));
if (args.includes("--d1") && only !== "actions") {
  const out = execFileSync("npx", ["wrangler", "d1", "execute", "vibebook", "--remote", "--json", "--command", "SELECT own, name, sender, text, topic, recent, memory, expected, note FROM router_cases ORDER BY ts DESC LIMIT 200"], { encoding: "utf8" });
  for (const r of JSON.parse(out)[0].results as Case[]) cases.push({ ...r, own: !!r.own });
}
let right = 0;
for (const c of cases) {
  const me = c.own ? "me@x" : "me@x", author = c.own ? "me@x" : "other@x";
  const fixed = rule({ author, agent: false, tag: null, for_who: null, mentions_you: /@\S/.test(c.text) && new RegExp(`@${c.name}`, "i").test(c.text), reply_author: null, epic_owner: null }, me);
  const m = { topic: c.topic ?? "sala principal", recent: c.recent ?? "", from: c.sender, text: c.text };
  const memory = c.memory ?? "Room: a product team. People and their agents: Ana (Claude), Bruno (Codex).";
  const got = fixed === "skip" ? "ignore" : fixed ? fixed.decision : c.own ? (await own(env, c.name, memory, m)).decision : ((await jev(env, c.name, memory, m))?.decision ?? "wake");
  const verdict = (got === "answer" ? "wake" : got) === c.expected;
  right += +verdict;
  console.log(`${verdict ? "ok " : "BAD"} ${got.padEnd(6)} (want ${c.expected}) ${c.own ? "own " : "other"} | ${c.note ?? ""} | ${c.text.slice(0, 70)}`);
}
let failed = false;
if (cases.length) {
  const score = right / cases.length;
  console.log(`\nwake: ${right}/${cases.length} = ${(score * 100).toFixed(0)}%`);
  if (score < min) { console.log(`wake below --min ${min}`); failed = true; }
}

type ActionCase = { action: string; note?: string; topic?: string; text: string; expected: boolean };
if (only !== "wake") {
  const actionCases: ActionCase[] = JSON.parse(readFileSync("scripts/router-action-cases.json", "utf8"));
  const tally: Record<string, { right: number; n: number; falseYes: number }> = {};
  for (const c of actionCases) {
    const thread = c.action === "answer_thread" ? "main" : "t1";
    const room: ActionRoom = {
      isDm: false,
      openThread: (t) => t === "t1",
      listening: async () => true,
      hasThreadFrom: () => false,
      markDone: () => {},
      makeAnswerThread: async () => {},
    };
    // Only the action under test, so each case measures one question.
    const actions = ROUTER_ACTIONS.filter((a) => a.name === c.action);
    const r = await runRouterActions({ id: 1, thread, author: "me@x", text: c.text }, room, (state, q) => decide(env, state, q), { topic: c.topic ?? "main" }, actions);
    const got = r.action === c.action;
    const t = (tally[c.action] ??= { right: 0, n: 0, falseYes: 0 });
    t.n++;
    t.right += +(got === c.expected);
    t.falseYes += +(got && !c.expected);
    console.log(`${got === c.expected ? "ok " : "BAD"} ${c.action.padEnd(13)} ${got ? "acts" : "no  "} (want ${c.expected ? "acts" : "no"}) p=${r.p.toFixed(2)} ${r.via ?? ""} | ${c.note ?? ""} | ${c.text.slice(0, 60)}`);
  }
  for (const [name, t] of Object.entries(tally)) {
    const score = t.right / t.n;
    console.log(`${name}: ${t.right}/${t.n} = ${(score * 100).toFixed(0)}% · false yes: ${t.falseYes}`);
    if (score < min) { console.log(`${name} below --min ${min}`); failed = true; }
  }
}
if (failed) process.exit(1);
