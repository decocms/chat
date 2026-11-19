import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { Glob } from "bun";
import { icons } from "../web/lib/studio/icons";

// Writes web/lib/studio/icons.svg, the one sprite of all icons, from web/lib/studio/icons.ts.
// `Icon.svelte` draws `<use href="<sprite>#<name>">`. Vite gives the sprite a hashed name in dist/assets/.
// Run `bun scripts/icon-sprite.ts` after you change icons.ts. `--check` fails if the committed sprite is different.
const root = join(import.meta.dirname, "..");
export const spritePath = join(root, "web/lib/studio/icons.svg");
const sourcePath = join(root, "web/lib/studio/icons.ts");

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/;

export function sprite(source: Record<string, readonly string[]>): string {
  const symbols = Object.entries(source).map(([name, paths]) => {
    if (!NAME.test(name))
      throw new Error(`Icon name is not kebab case: ${name}`);
    if (paths.length === 0) throw new Error(`Icon has no path: ${name}`);
    for (const d of paths)
      if (!PATH_DATA.test(d))
        throw new Error(`Icon path is not path data: ${name}`);
    const body = paths.map((d) => `<path d="${d}"/>`).join("");
    return `<symbol id="${name}" viewBox="0 0 24 24">${body}</symbol>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg">\n${symbols.join("\n")}\n</svg>\n`;
}

// The app must import only the type from icons.ts. A value import puts all path data into the JS bundle.
export function valueImports(): string[] {
  const found: string[] = [];
  const importFrom =
    /import\s+(type\s+)?\{([^}]*)\}\s*from\s*["']([^"']*)["']/g;
  for (const rel of new Glob("web/**/*.{ts,svelte}").scanSync(root)) {
    const file = join(root, rel);
    if (file === sourcePath) continue;
    const text = readFileSync(file, "utf8");
    for (const [, typeOnly, names, from] of text.matchAll(importFrom)) {
      if (!from || !/(^|\/)icons$/.test(from)) continue;
      const onlyTypes = names!
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
        .every((name) => name.startsWith("type "));
      if (!typeOnly && !onlyTypes) found.push(relative(root, file));
    }
  }
  return found;
}

if (import.meta.main) {
  const next = sprite(icons);
  const problems = valueImports().map(
    (file) =>
      `${file}: use \`import type { IconName }\`, not a value import of icons.ts`,
  );
  if (process.argv.includes("--check")) {
    let current = "";
    try {
      current = readFileSync(spritePath, "utf8");
    } catch {}
    if (current !== next)
      problems.push(
        "web/lib/studio/icons.svg is not the same as icons.ts. Run `bun scripts/icon-sprite.ts` and commit it.",
      );
  } else writeFileSync(spritePath, next);
  if (problems.length) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
  console.info(
    `${Object.keys(icons).length} icons in web/lib/studio/icons.svg`,
  );
}
