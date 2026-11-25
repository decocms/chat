// Agent roles (epic "Roles para agents", Nov 2026): a room file `agents/<role>.md` whose frontmatter names a role
// (persona-style, like Buzz's .persona.md) and whose body is that role's context. A Claude started with
// `vibebook listen --role <name>` is that role in the room; one without a role is the Primary (unchanged behavior).

export type Role = {
  name: string;
  display_name: string;
  /** Wakes on `@<name>` (default true). */
  mentions: boolean;
  /** Also wakes when your human's message contains one of these words. */
  keywords: string[];
  model: string | null;
  /** The markdown body: who this role is and how it works. */
  context: string;
};

export const ROLE_NAME = /^[a-z0-9][a-z0-9_-]{0,30}$/;
const unquote = (s: string) =>
  s
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** A role file's frontmatter + body, or null when it isn't a role file (no frontmatter, or no valid name). A sandbox's
 *  CLAUDE.md (`agents/<room>.md`, src/sandbox.ts) has no frontmatter, so it stays a plain file. Tiny YAML subset:
 *  `key: value`, a nested `triggers:` block, lists inline (`[a, b]`) or as `- item` lines. */
export function parseRole(md: string): Role | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(md);
  if (!m) return null;
  const top: Record<string, string> = {},
    trig: Record<string, string> = {},
    lists: Record<string, string[]> = {};
  let section = "",
    listKey = "";
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const item = /^\s*-\s+(.*)$/.exec(raw);
    if (item && listKey) {
      (lists[listKey] ??= []).push(unquote(item[1]));
      continue;
    }
    const kv = /^(\s*)([\w-]+):\s*(.*)$/.exec(raw);
    if (!kv) continue;
    const [, indent, key, value] = kv;
    if (!indent) section = value ? "" : key;
    const into = indent && section === "triggers" ? trig : top;
    listKey = key;
    if (value.startsWith("["))
      lists[listKey] = value
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map(unquote)
        .filter(Boolean);
    else into[key] = unquote(value);
  }
  const name = (top.name ?? "").toLowerCase();
  if (!ROLE_NAME.test(name) || name === "primary") return null;
  return {
    name,
    display_name: (top.display_name || name).slice(0, 40),
    mentions: trig.mentions !== "false",
    keywords: (lists.keywords ?? [])
      .map((k) => k.slice(0, 40))
      .filter(Boolean)
      .slice(0, 20),
    model: top.model || null,
    context: m[2].trim().slice(0, 20_000),
  };
}

/** The @handles in a text, lowercased (same shape as the app's mentions). */
export const handlesOf = (text: string) =>
  [...text.matchAll(/(?:^|[\s(])@([\p{L}\p{N}._-]+)/gu)].map((x) => fold(x[1]));

/** Is this text for the role: `@<name>` (when mentions are on) or one of its keywords as a whole word. */
export function forRole(text: string, role: Role): boolean {
  if (role.mentions && handlesOf(text).includes(role.name)) return true;
  const t = fold(text);
  return role.keywords.some((k) =>
    new RegExp(
      `(^|[^\\p{L}\\p{N}])${fold(k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`,
      "u",
    ).test(t),
  );
}

/** Does this new message wake this agent? `mine` = written by the agent's own human (or a reminder for them);
 *  `ownAgent` = written by another agent of the same human (a planner sending commands to an executor, Gui #3672),
 *  never another person's agents. A role agent wakes only for those messages when they are for its role. With
 *  `self` (src/agentNames.ts), a message of its side that says its @name wakes it, and only the Primary gets the rest;
 *  the Primary leaves its side's messages that @address one of the room's roles or another of its human's agents. */
export function wakes(
  msg: { mine: boolean; ownAgent?: boolean; text: string },
  myRole: Role | null,
  roles: Role[],
  self?: { name: string; primary: boolean; others: string[] },
): boolean {
  const own = msg.mine || !!msg.ownAgent;
  if (myRole) return own && forRole(msg.text, myRole);
  const at = handlesOf(msg.text);
  if (self && own && at.includes(self.name)) return true;
  if (self && !self.primary) return false;
  if (!own) return true;
  return (
    !roles.some((r) => at.includes(r.name)) &&
    !(self?.others ?? []).some((n) => at.includes(n))
  );
}
