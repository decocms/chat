// The router's bench: every change to the router (src/router-rule.ts, src/router-jev.ts, src/routerActions.ts) runs
// against these cases, and every case must pass (Gimenes #4444). Parts:
// - wake: scripts/router-cases.json (anonymized seed, in the repo).
// - wake_d1 (with --d1): the cases people's agents recorded in production with MCP router_feedback (D1 router_feedback,
//   action "wake", read at run time, never written here). Their text is real room content and this repo's CI logs are
//   public, so a D1 case prints only its number and scores.
// - "<action> (D1)" (with --d1): the D1 cases of every router action and reading (mark_done, answer_thread, waits…),
//   one part each. A new action gets its part when its first case is recorded (Gimenes #4481).
// - actions: scripts/router-action-cases.json, each router action on messages it must and must not act on, through
//   runRouterActions with the real Jev (Gimenes #4382). A false "yes" (closing a thread nobody closed) is the costly
//   miss, so the report shows false positives apart.
// Jev varies a little between runs, so a case that fails runs two more times and passes if both pass (2 of 3).
//   bun scripts/router-bench.ts [--d1] [--min 0.85] [--only wake|actions] [--json scores.json]
// CI: .github/workflows/router-bench.yml runs it on main and on the PR and compares (scripts/router-bench-compare.ts).
// Needs OPENROUTER_API_KEY in .dev.vars (real Jev calls, ~US$0.00002 each); --d1 needs a wrangler login or
// CLOUDFLARE_API_TOKEN (D1 read).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { rule } from "../src/router-rule";
import { jev, own } from "../src/router-jev";
import { decide } from "../src/jev";
import { existsSync as has, writeFileSync } from "node:fs";

type Case = { d1?: boolean; note?: string; own: boolean; name: string; sender: string; text: string; topic?: string; recent?: string; memory?: string; expected: "wake" | "ignore" };
const args = process.argv.slice(2), min = Number(args[args.indexOf("--min") + 1]) || 0;
/** A case passes on its first try, or on both of two more tries (2 of 3): Jev's noise does not fail a case, a real
 *  miss does. */
async function settle(run: () => Promise<boolean>) {
  if (await run()) return { ok: true, runs: 1 };
  const a = await run(), b = await run();
  return { ok: a && b, runs: 3 };
}
// The key comes from .dev.vars, or from the shell (OPENROUTER_API_KEY) when there is no .dev.vars here.
const vars = Object.fromEntries((existsSync(".dev.vars") ? readFileSync(".dev.vars", "utf8") : `OPENROUTER_API_KEY=${process.env.OPENROUTER_API_KEY ?? ""}`).split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]));
const env = { ...vars, MODEL_JUDGE: readFileSync("wrangler.jsonc", "utf8").match(/"MODEL_JUDGE":\s*"([^"]+)"/)?.[1] } as never;
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : "";
const cases: Case[] = only === "actions" ? [] : JSON.parse(readFileSync("scripts/router-cases.json", "utf8"));
// The database is "chat" (wrangler.jsonc). stderr is dropped: wrangler's logs carry nothing useful here.
const d1 = <T>(sql: string): T[] => JSON.parse(execFileSync("bunx", ["wrangler", "d1", "execute", "chat", "--remote", "--json", "--command", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))[0].results;
/** The D1 cases of every action that is not wake (router_feedback, action <> 'wake'): their own parts, "<action> (D1)". */
type D1ActionRow = { action: string; who: string; name: string; text: string; thread: string; topic: string; recent: string; people: string; expected: string; note: string };
let d1Actions: D1ActionRow[] = [];
if (args.includes("--d1")) {
  // router_feedback holds every case (Gimenes #4483). Before the deploy that makes it, the old table has the wake cases.
  let rows: (Case & { action?: string })[] = [];
  try {
    rows = d1(`SELECT action, who, own, name, sender, text, thread, topic, recent, memory, people, expected, note FROM router_feedback WHERE status = 'case' ORDER BY ts DESC LIMIT 500`);
  } catch {
    rows = d1<Case>(`SELECT own, name, sender, text, topic, recent, memory, expected, note FROM router_cases ORDER BY ts DESC LIMIT 200`).map((r) => ({ ...r, action: "wake" }));
  }
  if (only !== "actions") for (const r of rows.filter((r) => r.action === "wake")) cases.push({ ...r, own: !!r.own, d1: true });
  if (only !== "wake") d1Actions = rows.filter((r) => r.action !== "wake") as unknown as D1ActionRow[];
}
const wakeTally = { wake: { right: 0, n: 0 }, wake_d1: { right: 0, n: 0 } };
let d1n = 0;
for (const c of cases) {
  const me = c.own ? "me@x" : "me@x", author = c.own ? "me@x" : "other@x";
  const fixed = rule({ author, agent: false, tag: null, for_who: null, mentions_you: /@\S/.test(c.text) && new RegExp(`@${c.name}`, "i").test(c.text), reply_author: null, epic_owner: null }, me);
  const m = { topic: c.topic ?? "sala principal", recent: c.recent ?? "", from: c.sender, text: c.text };
  const memory = c.memory ?? "Room: a product team. People and their agents: Ana (Claude), Bruno (Codex).";
  let got = "", why = "";
  const { ok, runs } = await settle(async () => {
    const r = fixed === "skip" ? { decision: "ignore", why: "skip" } : fixed ? fixed : c.own ? await own(env, c.name, memory, m) : await jev(env, c.name, memory, m);
    got = r?.decision ?? "wake";
    why = r?.why ?? "Jev falhou";
    return (got === "answer" ? "wake" : got) === c.expected;
  });
  const t = wakeTally[c.d1 ? "wake_d1" : "wake"];
  t.n++;
  t.right += +ok;
  // A D1 case shows only the scores of its why (names and words in it come from a real room).
  const shown = c.d1 ? `d1 #${++d1n} · ${why.match(/\d\.\d\d/g)?.join(" ") ?? ""}` : `${c.text.slice(0, 70)} · ${why}`;
  console.log(`${ok ? "ok " : "BAD"} ${got.padEnd(6)} (want ${c.expected}) ${c.own ? "own " : "other"}${runs > 1 ? " (3 runs)" : ""} | ${c.note ?? ""} | ${shown}`);
}
let failed = false;
// The scores, for --json: right/n per part; false yes per action.
const scores: { wake?: { right: number; n: number }; wake_d1?: { right: number; n: number }; actions: Record<string, { right: number; n: number; falseYes: number }> } = { actions: {} };
for (const [part, t] of Object.entries(wakeTally)) {
  if (!t.n) continue;
  scores[part as "wake" | "wake_d1"] = t;
  const score = t.right / t.n;
  console.log(`\n${part}: ${t.right}/${t.n} = ${(score * 100).toFixed(0)}%`);
  if (score < min) { console.log(`${part} below --min ${min}`); failed = true; }
}

// An action case: expected = the action acts. A waits case (action "waits"): waits = the first names the message
// waits on ([] = nobody); thread "main" unless topic is set; before = the talk before it. A D1 case (d1) has its own
// room (author, people, thread) and, for waits, one person (who): expected = that person waits on it.
type ActionCase = { action: string; note?: string; topic?: string; text: string; expected?: boolean; waits?: string[]; before?: string; d1?: boolean; author?: string; people?: string[]; who?: string; thread?: string };
// The room of every repo case, as in production: the author (Leo) and three other people, so the waits reading joins
// the same Jev call as the actions.
const PEOPLE = ["Ana", "Bruno", "Carla"];
// A base without router actions (main before them) has only the wake part.
if (only !== "wake" && has("src/routerActions.ts")) {
  const mod = await import("../src/routerActions");
  const { runRouterActions } = mod;
  type ActionRoom = import("../src/routerActions").ActionRoom;
  // A base from before the waits reading (stage 1) skips the waits cases: they are "new" there.
  const hasWaits = !!(mod as { ROUTER_READINGS?: { name: string }[] }).ROUTER_READINGS?.some((r) => r.name === "waits");
  const actionCases: ActionCase[] = JSON.parse(readFileSync("scripts/router-action-cases.json", "utf8"));
  for (const r of d1Actions) {
    const people: { email: string; name: string }[] = JSON.parse(r.people || "[]");
    actionCases.push({ d1: true, action: r.action, text: r.text, topic: r.topic, thread: r.thread === "main" ? "main" : "t1", before: r.recent, author: r.name, people: people.map((p) => p.name), who: people.find((p) => p.email === r.who)?.name, expected: r.expected === "acts", note: r.note });
  }
  const tally: Record<string, { right: number; n: number; falseYes: number }> = {};
  let d1a = 0;
  for (const c of actionCases) {
    if (c.action === "waits" && !hasWaits) continue;
    const thread = c.thread ?? (c.action === "mark_done" || (c.action === "waits" && c.topic) ? "t1" : "main");
    const names0 = c.people ?? PEOPLE, author = c.author ?? "Leo";
    const email = (n: string) => `${n.toLowerCase()}@x`;
    const room: ActionRoom = {
      isDm: false,
      openThread: (t) => t === "t1",
      listening: async () => true,
      hasThreadFrom: () => false,
      markDone: () => {},
      makeAnswerThread: async () => {},
      people: async () => ({
        others: names0.map((n) => ({ email: email(n), name: n })),
        roster: [author, ...names0].join(", "),
        before: c.before ?? "",
        author,
        tagged: names0.filter((n) => new RegExp(`@${n.split(/\s+/)[0]}\\b`, "i").test(c.text)).map(email),
      }),
      saveWaits: async () => {},
    };
    // Every action and reading, as in production: one Jev call per message.
    const ask = () => runRouterActions({ id: 1, thread, author: email(author), text: c.text }, room, (state, q) => decide(env, state, q), { topic: c.topic || "main" });
    const part = c.d1 ? `${c.action} (D1)` : c.action;
    const t = (tally[part] ??= { right: 0, n: 0, falseYes: 0 });
    t.n++;
    const want = [...(c.waits ?? [])].sort();
    let r!: Awaited<ReturnType<typeof ask>>;
    let names: string[] = [];
    let wrongYes = false;
    const { ok, runs } = await settle(async () => {
      r = await ask();
      if (c.action === "waits") {
        names = ((r as { read?: Record<string, string[]> }).read?.waits ?? []).map((e) => names0.find((n) => email(n) === e)!).sort();
        if (c.d1) {
          const waits = !!c.who && names.includes(c.who);
          wrongYes = waits && !c.expected;
          return waits === !!c.expected;
        }
        wrongYes = names.some((n) => !want.includes(n));
        return names.join() === want.join();
      }
      const acts = r.action === c.action;
      wrongYes = acts && !c.expected;
      return acts === c.expected;
    });
    t.right += +ok;
    // A false yes counts when the case fails on one: the last run said yes wrongly.
    t.falseYes += +(!ok && wrongYes);
    const again = runs > 1 ? " (3 runs)" : "";
    // A D1 case shows only its number and score (its text and names come from a real room).
    if (c.d1) {
      console.log(`${ok ? "ok " : "BAD"} ${part.padEnd(18)} (want ${c.expected ? "acts" : "no"}) p=${r.p.toFixed(2)}${again} | d1 #${++d1a}`);
      continue;
    }
    if (c.action === "waits") {
      console.log(`${ok ? "ok " : "BAD"} waits         [${names.join(",")}] (want [${want.join(",")}])${again} | ${c.note ?? ""} | ${c.text.slice(0, 60)}`);
      continue;
    }
    const acts = r.action === c.action;
    console.log(`${ok ? "ok " : "BAD"} ${c.action.padEnd(13)} ${acts ? "acts" : "no  "} (want ${c.expected ? "acts" : "no"}) p=${r.p.toFixed(2)} ${r.via ?? ""}${again} | ${c.note ?? ""} | ${c.text.slice(0, 60)}`);
  }
  scores.actions = tally;
  for (const [name, t] of Object.entries(tally)) {
    const score = t.right / t.n;
    console.log(`${name}: ${t.right}/${t.n} = ${(score * 100).toFixed(0)}% · false yes: ${t.falseYes}`);
    if (score < min) { console.log(`${name} below --min ${min}`); failed = true; }
  }
}
if (args.includes("--json")) writeFileSync(args[args.indexOf("--json") + 1], JSON.stringify(scores));
if (failed) process.exit(1);
