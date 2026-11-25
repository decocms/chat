// Local only: adds the token tweaker to an already built dist/ (bun run build:ui first).
// Wire it in a local wrangler config: "build": { "command": "bun run build:ui && bun dev/token-tweaker/inject.ts" }.
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dirname, "../..");
const html = join(root, "dist/index.html");
await copyFile(
  join(import.meta.dirname, "token-tweaker.js"),
  join(root, "dist/token-tweaker.js"),
);
const page = await readFile(html, "utf8");
const tag = '<script type="module" src="/token-tweaker.js"></script>';
if (!page.includes(tag))
  await writeFile(html, page.replace("</body>", `${tag}</body>`));
console.log("token tweaker added to dist/");
