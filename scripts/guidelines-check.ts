// Turns the written rules (docs/stack.md, docs/folder-map.md, AGENTS.md) into
// a failing check. Old code breaks some rules, so the counts per rule and file
// are a ratchet in scripts/data/guidelines-baseline.json: a new violation or a
// higher count fails, and a lower count asks for a lower baseline (`--update`).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

export type Rule =
  | "color"
  | "breakpoint"
  | "style-block"
  | "css-import"
  | "fetch"
  | "atomic"
  | "markdown-file"
  | "markdown-link"
  | "folder-map";
export type Violation = {
  rule: Rule;
  file: string;
  line: number;
  text: string;
};
export type Baseline = Partial<Record<Rule, Record<string, number>>>;
export type Source = { path: string; text: () => string };

const LEVELS = ["atoms", "molecules", "organisms"] as const;
const PALETTE =
  "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe";
const COLOR_UTILITY =
  "bg|text|border(?:-[xytrblse])?|ring|ring-offset|outline|fill|stroke|from|via|to|decoration|shadow|inset-shadow|inset-ring|accent|caret|divide|placeholder";
const PALETTE_CLASS = new RegExp(
  `^-?(?:${COLOR_UTILITY})-(?:(?:${PALETTE})-\\d{2,3}|black|white)$`,
);
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const TOKEN = /tw:[^\s"'`{}<>]+/g;
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*|<!--)/;
const MARKDOWN_ALLOWED = [
  /^README\.md$/,
  /^AGENTS\.md$/,
  /^docs\/[^/]+\.md$/,
  /^claude-plugin\/commands\/[^/]+\.md$/,
  /^claude-plugin\/skills\/[^/]+\/SKILL\.md$/,
  /^herdr-plugin\/README\.md$/,
  /^\.github\/pull_request_template\.md$/,
];

/** Splits `max-md:hover:tw-x` at the colons outside brackets. */
function segments(token: string): string[] {
  const parts: string[] = [];
  let depth = 0,
    start = 0;
  for (let i = 0; i < token.length; i++) {
    const c = token[i];
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth = Math.max(0, depth - 1);
    else if (c === ":" && depth === 0) {
      parts.push(token.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(token.slice(start));
  return parts;
}

function badBreakpoint(variant: string): boolean {
  if (variant.startsWith("@")) return false; // container query, not the screen
  // The theme has one breakpoint token, md (svelte/styles/tailwind.css): md = desktop, max-md = mobile.
  if (variant === "md" || variant === "max-md") return false;
  if (/^(?:max-|min-)?(?:sm|lg|xl|[2-7]xl)$/.test(variant)) return true;
  return /^(max|min)-\[.+\]$/.test(variant); // pixel values: use md / max-md
}

function badColor(utility: string): boolean {
  const bare = utility.replace(/^!|!$/g, "");
  if (/\[[^\]]*#[0-9a-fA-F]{3,8}\b[^\]]*\]/.test(bare)) return true;
  return PALETTE_CLASS.test(bare.replace(/\/[^/]+$/, ""));
}

/** A width media query written as a literal: use MOBILE_QUERY from svelte/lib/breakpoints.ts. */
function badMedia(line: string): boolean {
  return /(?:matchMedia|MediaQuery)\([^)]*?\(\s*(?:max|min)-width\s*:/.test(
    line,
  );
}

const isSvelteSource = (path: string) =>
  path.startsWith("svelte/") &&
  /\.(?:svelte|ts)$/.test(path) &&
  !path.startsWith("svelte/build/") &&
  !/\.(?:test|typetest)\.ts$/.test(path) &&
  !/(?:^|\/)vite\.config\.ts$/.test(path) &&
  !path.endsWith(".d.ts");

/** The Svelte app proper: features, lib and the root files of svelte/. */
const isAppSource = (path: string) =>
  isSvelteSource(path) &&
  (path.startsWith("svelte/features/") ||
    path.startsWith("svelte/lib/") ||
    !path.slice("svelte/".length).includes("/"));

export function auditSvelte(path: string, text: string): Violation[] {
  const out: Violation[] = [];
  const lines = text.split("\n");
  const add = (rule: Rule, index: number, detail?: string) =>
    out.push({
      rule,
      file: path,
      line: index + 1,
      text: (detail ?? lines[index] ?? "").trim().slice(0, 160),
    });
  lines.forEach((line, i) => {
    if (COMMENT_LINE.test(line)) return;
    for (const [token] of line.matchAll(TOKEN)) {
      const parts = segments(token.slice(3));
      const utility = parts.pop() ?? "";
      if (badColor(utility)) add("color", i, token);
      for (const variant of parts)
        if (badBreakpoint(variant)) add("breakpoint", i, token);
    }
    if (badMedia(line)) add("breakpoint", i);
    if (path.endsWith(".svelte") && /<style[\s>]/.test(line))
      add("style-block", i);
    if (
      path !== "svelte/styles.ts" &&
      /(?:import\s*\(?\s*|from\s+)["'][^"']+\.css(?:\?[^"']*)?["']/.test(line)
    )
      add("css-import", i);
    if (
      isAppSource(path) &&
      /(?:(?<![\w$.])|(?<=\b(?:window|globalThis|self)\.))fetch\s*\(/.test(line)
    )
      add("fetch", i);
  });
  return out;
}

function resolveImport(from: string, spec: string): string | undefined {
  if (spec.startsWith("$lib/")) return normalize(`svelte/lib/${spec.slice(5)}`);
  if (spec.startsWith("./") || spec.startsWith("../"))
    return normalize(join(dirname(from), spec));
  return undefined;
}

function svelteImports(path: string, text: string) {
  const out: { target: string; line: number }[] = [];
  text.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(
      /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+\.svelte)["']/g,
    )) {
      const target = m[1] && resolveImport(path, m[1]);
      if (target) out.push({ target, line: i + 1 });
    }
  });
  return out;
}

/** Each component's level is the lowest level of a story that imports it. */
export function componentLevels(sources: Source[]): Map<string, number> {
  const levels = new Map<string, number>();
  for (const source of sources) {
    const m =
      /^svelte\/parity\/stories\/(atoms|molecules|organisms)-[^/]+\.svelte$/.exec(
        source.path,
      );
    if (!m) continue;
    const level = LEVELS.indexOf(m[1] as (typeof LEVELS)[number]);
    for (const { target } of svelteImports(source.path, source.text()))
      levels.set(target, Math.min(level, levels.get(target) ?? level));
  }
  return levels;
}

export function auditAtomic(sources: Source[]): Violation[] {
  const levels = componentLevels(sources);
  const out: Violation[] = [];
  for (const source of sources) {
    const level = levels.get(source.path);
    if (level === undefined) continue;
    for (const { target, line } of svelteImports(source.path, source.text())) {
      const other = levels.get(target);
      if (other !== undefined && other > level)
        out.push({
          rule: "atomic",
          file: source.path,
          line,
          text: `${LEVELS[level]} imports ${LEVELS[other]} ${target}`,
        });
    }
  }
  return out;
}

export function auditMarkdown(
  files: string[],
  read: (path: string) => string,
): Violation[] {
  const out: Violation[] = [];
  const tracked = new Set(files);
  for (const file of files)
    if (file.endsWith(".md") && !MARKDOWN_ALLOWED.some((re) => re.test(file)))
      out.push({
        rule: "markdown-file",
        file,
        line: 1,
        text: "Markdown file outside the allowed places (docs/writing.md, rule 6)",
      });
  const linked = files.filter(
    (f) =>
      f === "AGENTS.md" || f === "README.md" || /^docs\/[^/]+\.md$/.test(f),
  );
  for (const file of linked) {
    let fenced = false;
    read(file)
      .split("\n")
      .forEach((line, i) => {
        if (/^\s*(?:```|~~~)/.test(line)) fenced = !fenced;
        if (fenced) return;
        const prose = line.replace(/`[^`]*`/g, "");
        for (const m of prose.matchAll(
          /\[[^\]]*\]\(\s*<?([^)\s>]+)>?[^)]*\)/g,
        )) {
          const href = m[1] ?? "";
          if (/^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(href)) continue;
          const path = normalize(
            join(dirname(file), decodeURIComponent(href.split("#")[0] ?? "")),
          ).replace(/\/$/, "");
          const exists =
            tracked.has(path) || files.some((f) => f.startsWith(`${path}/`));
          if (!exists)
            out.push({
              rule: "markdown-link",
              file,
              line: i + 1,
              text: `broken link ${href}`,
            });
        }
      });
  }
  const map = tracked.has("docs/folder-map.md")
    ? read("docs/folder-map.md")
    : "";
  const dirs = new Set(
    files
      .filter((f) => f.includes("/"))
      .map((f) => f.slice(0, f.indexOf("/")))
      .filter(
        (d) => !d.startsWith(".") || d === ".github" || d === ".claude-plugin",
      ),
  );
  for (const dir of [...dirs].sort())
    if (!map.includes(`\`${dir}/`))
      out.push({
        rule: "folder-map",
        file: dir,
        line: 1,
        text: `top-level folder ${dir}/ is missing from docs/folder-map.md`,
      });
  return out;
}

export function audit(
  files: string[],
  read: (path: string) => string,
): Violation[] {
  const svelte = files.filter(isSvelteSource);
  const cache = new Map<string, string>();
  const text = (path: string) => {
    let value = cache.get(path);
    if (value === undefined) cache.set(path, (value = read(path)));
    return value;
  };
  const sources: Source[] = svelte.map((path) => ({
    path,
    text: () => text(path),
  }));
  return [
    ...svelte.flatMap((path) => auditSvelte(path, text(path))),
    ...auditAtomic(sources),
    ...auditMarkdown(files, text),
  ];
}

export function count(violations: Violation[]): Baseline {
  const out: Baseline = {};
  for (const v of violations) {
    const rule = (out[v.rule] ??= {});
    rule[v.file] = (rule[v.file] ?? 0) + 1;
  }
  const sorted: Baseline = {};
  for (const rule of Object.keys(out).sort() as Rule[])
    sorted[rule] = Object.fromEntries(
      Object.entries(out[rule] ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    );
  return sorted;
}

/** Compares counts with the baseline. Returns the messages that fail the check. */
export function compare(
  violations: Violation[],
  baseline: Baseline,
): { increased: string[]; decreased: string[] } {
  const now = count(violations);
  const increased: string[] = [];
  const decreased: string[] = [];
  const rules = new Set([
    ...Object.keys(now),
    ...Object.keys(baseline),
  ] as Rule[]);
  for (const rule of [...rules].sort()) {
    const current = now[rule] ?? {};
    const allowed = baseline[rule] ?? {};
    for (const file of new Set([
      ...Object.keys(current),
      ...Object.keys(allowed),
    ])) {
      const n = current[file] ?? 0,
        max = allowed[file] ?? 0;
      if (n > max) {
        increased.push(`${rule} ${file}: ${n} (baseline ${max})`);
        for (const v of violations)
          if (v.rule === rule && v.file === file)
            increased.push(`  ${v.file}:${v.line} ${v.text}`);
      } else if (n < max)
        decreased.push(`${rule} ${file}: ${n} (baseline ${max})`);
    }
  }
  return { increased, decreased };
}

if (import.meta.main) {
  const root = join(import.meta.dir, "..");
  const baselinePath = join(root, "scripts/data/guidelines-baseline.json");
  const listed = Bun.spawnSync(["git", "ls-files", "-z"], { cwd: root });
  if (listed.exitCode !== 0) throw new Error("git ls-files failed");
  const files = listed.stdout
    .toString()
    .split("\0")
    .filter((f) => f && existsSync(join(root, f)));
  const violations = audit(files, (path) =>
    readFileSync(join(root, path), "utf8"),
  );
  if (process.argv.includes("--update")) {
    writeFileSync(
      baselinePath,
      `${JSON.stringify(count(violations), null, 2)}\n`,
    );
    console.info(
      `Wrote ${violations.length} known violations to the baseline.`,
    );
    process.exit(0);
  }
  const baseline: Baseline = existsSync(baselinePath)
    ? JSON.parse(readFileSync(baselinePath, "utf8"))
    : {};
  const { increased, decreased } = compare(violations, baseline);
  if (increased.length) {
    console.error(
      "New guideline violations (see docs/stack.md, docs/folder-map.md, docs/writing.md):",
    );
    for (const line of increased) console.error(line);
  }
  if (decreased.length) {
    console.error(
      "Fewer violations than the baseline. Good. Lower the baseline: bun scripts/guidelines-check.ts --update",
    );
    for (const line of decreased) console.error(line);
  }
  if (increased.length || decreased.length) process.exit(1);
  console.info(
    `guidelines: ok (${violations.length} known violations in the baseline)`,
  );
}
