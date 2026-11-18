// Writes the shared agent rules (shared/agentRules.ts) into the static prompts.
// A region is `<!-- agent-rules:<name> -->` … `<!-- /agent-rules -->`. The
// script replaces the lines between the two markers with the block, indented
// like the opening marker.
//   bun scripts/agent-prompts.ts          rewrite the regions
//   bun scripts/agent-prompts.ts --check  fail if a region is different
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AGENT_RULES } from "../shared/agentRules.ts";

const root = join(import.meta.dir, "..");
export const PROMPT_FILES = [
  "claude-plugin/skills/vibebook/SKILL.md",
  "claude-plugin/commands/listen.md",
  "claude-plugin/commands/setup.md",
  "public/llms.txt",
];

const OPEN = /^([ \t]*)<!-- agent-rules:([\w-]+) -->[ \t]*$/;
const CLOSE = /^[ \t]*<!-- \/agent-rules -->[ \t]*$/;

export function render(
  text: string,
  file: string,
): { text: string; used: string[] } {
  const rules: Record<string, string> = AGENT_RULES;
  const out: string[] = [];
  const used: string[] = [];
  const rows = text.split("\n");
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (CLOSE.test(row))
      throw new Error(`${file}:${i + 1}: close marker without an open marker`);
    const open = OPEN.exec(row);
    if (!open) {
      out.push(row);
      continue;
    }
    const [, indent = "", name = ""] = open;
    const block = rules[name];
    if (block === undefined)
      throw new Error(`${file}:${i + 1}: unknown rule block "${name}"`);
    let end = i + 1;
    while (end < rows.length && !CLOSE.test(rows[end]!)) {
      if (OPEN.test(rows[end]!))
        throw new Error(
          `${file}:${end + 1}: open marker inside region "${name}"`,
        );
      end++;
    }
    if (end === rows.length)
      throw new Error(`${file}:${i + 1}: region "${name}" has no close marker`);
    out.push(row);
    for (const line of block.split("\n")) out.push(line ? indent + line : "");
    out.push(`${indent}<!-- /agent-rules -->`);
    used.push(name);
    i = end;
  }
  return { text: out.join("\n"), used };
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const stale: string[] = [];
  const used = new Set<string>();
  for (const file of PROMPT_FILES) {
    const path = join(root, file);
    const before = readFileSync(path, "utf8");
    const after = render(before, file);
    after.used.forEach((name) => used.add(name));
    if (after.text === before) continue;
    if (check) stale.push(file);
    else {
      writeFileSync(path, after.text);
      console.info(`wrote ${file}`);
    }
  }
  if (stale.length) {
    console.error(
      `Agent rule copies differ from shared/agentRules.ts:\n${stale.map((f) => `  ${f}`).join("\n")}\nRun: bun scripts/agent-prompts.ts`,
    );
    process.exit(1);
  }
  if (check)
    console.info(
      `agent prompts match shared/agentRules.ts (${used.size} blocks used)`,
    );
}
