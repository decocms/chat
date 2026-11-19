import {
  TERMINAL_VENDOR_FAMILY,
  TERMINAL_ARTIFACTS,
  terminalVendorProblems,
  terminalArtifactMatches,
} from "./terminal-vendor-policy";
import { readdir, readFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { createHash } from "node:crypto";
import postcss, { type AnyNode } from "postcss";
import { projectRoot } from "../web/build/clientBoundary";
import {
  auditPresentation,
  auditTailwind,
  type StyleViolation,
} from "./style-policy";

const native = process.argv.includes("--native");
const issues: StyleViolation[] = [];
const files: string[] = [];
async function collect(path: string) {
  for (const entry of await readdir(join(projectRoot, path), {
    withFileTypes: true,
  })) {
    const name = `${path}/${entry.name}`;
    if (entry.isDirectory()) await collect(name);
    else if (/\.(?:svelte|html|[cm]?[jt]s|css|scss|sass|less)$/.test(name))
      files.push(name);
  }
}
if (native) {
  for (const directory of [
    "web/app-document",
    "web/lib/ui",
    "web/lib/studio",
    "web/dev/design-system",
    "web/lib/components",
    "web/dev/gallery",
    "web/styles",
    "web/features/board",
    "web/features/navigation",
    "web/features/pins",
    "web/features/reminders",
    "web/features/files",
    "web/features/decisions",
    "web/features/people",
    "web/features/auth",
    "web/features/pwa",
    "web/features/notifications",
    "web/features/chat",
    "web/features/rich-text",
    "web/features/chat-interactive",
    "web/features/home",
    "web/features/onboarding",
    "web/features/app-navigation",
    "web/features/rooms",
    "web/features/documents",
    "web/features/account",
    "web/features/agents",
    "web/features/sandboxes",
    "web/features/file-viewer",
    "web/features/composer",
    "web/features/room-sidebar",
    "web/features/waits",
    "web/features/apps",
    "web/features/room-layout",
    "web/features/application",
    "web/features/room-shell",
  ])
    await collect(directory);
  files.push(
    "web/features/application/Inbox.svelte",
    "web/features/tasks/TaskList.svelte",
    "web/features/tasks/Tasks.svelte",
    "web/features/board/Board.svelte",
    "web/features/files/Files.svelte",
    "web/features/reminders/Reminders.svelte",
    "web/features/decisions/Decisions.svelte",
    "web/features/people/People.svelte",
    "web/features/room-sidebar/Sidebar.svelte",
    "web/app/sidebar.ts",
    "web/features/chat/Chat.svelte",
    "web/features/composer/Composer.svelte",
    "web/features/chat/Message.svelte",
    "web/app/chatTypes.ts",
    "web/styles.ts",
    "web/dev/gallery.html",
    "web/dev/design-system.html",
  );
} else {
  await collect("web");
  files.push("public/app.html");
}
for (const file of files.sort()) {
  const source = await readFile(join(projectRoot, file), "utf8");
  if (file.endsWith(".d.ts")) continue;
  if (/\.(?:css|scss|sass|less)$/.test(file)) {
    if (file !== "web/styles/tailwind.css")
      issues.push({ file, line: 1, reason: "Additional authored stylesheet" });
    else issues.push(...auditTailwind(file, source));
  } else issues.push(...auditPresentation(file, source));
}
const assets = (
  await readdir(join(projectRoot, "public/svelte-preview"))
).filter((name) => name.endsWith(".css"));
if (assets.length !== 1 || assets[0] !== "ui.css")
  issues.push({
    file: "public/svelte-preview",
    line: 1,
    reason: "Expected one emitted application CSS asset: ui.css",
  });
else {
  const generated = postcss.parse(
    await readFile(join(projectRoot, "public/svelte-preview/ui.css"), "utf8"),
  );
  generated.walkRules((rule) => {
    let parent: AnyNode | undefined = rule.parent;
    let baseReset = false;
    while (parent) {
      if (
        parent.type === "atrule" &&
        parent.name === "layer" &&
        parent.params === "base"
      )
        baseReset = true;
      parent = parent.parent;
    }
    if (baseReset && rule.selectors.some((selector) => selector.includes("&")))
      issues.push({
        file: "public/svelte-preview/ui.css",
        line: rule.source?.start?.line ?? 1,
        reason: "The base reset retained unresolved nesting",
      });
  });
  generated.walkAtRules("scope", (rule) => {
    issues.push({
      file: "public/svelte-preview/ui.css",
      line: rule.source?.start?.line ?? 1,
      reason: "Unlowered @scope exceeds the supported browser baseline",
    });
  });
  generated.walkDecls((declaration) => {
    if (/url\(["']?data:(?:font|application\/font)/.test(declaration.value))
      issues.push({
        file: "public/svelte-preview/ui.css",
        line: declaration.source?.start?.line ?? 1,
        reason: "Font bytes inlined into application CSS",
      });
  });
}
const manifest: unknown = JSON.parse(
  await readFile(join(projectRoot, "scripts/data/font-assets.json"), "utf8"),
);
const generator: unknown = JSON.parse(
  await readFile(join(projectRoot, "components.json"), "utf8"),
);
if (
  !generator ||
  typeof generator !== "object" ||
  !("tailwind" in generator) ||
  !generator.tailwind ||
  typeof generator.tailwind !== "object" ||
  !("css" in generator.tailwind) ||
  generator.tailwind.css !== "web/styles/tailwind.css"
)
  throw new Error("Component generator must use the sole Tailwind entry");
if (
  !manifest ||
  typeof manifest !== "object" ||
  !("records" in manifest) ||
  !Array.isArray(manifest.records)
)
  throw new Error("Invalid font manifest");
for (const entry of manifest.records) {
  if (
    !entry ||
    typeof entry !== "object" ||
    !("name" in entry) ||
    typeof entry.name !== "string" ||
    !("sha256" in entry) ||
    typeof entry.sha256 !== "string"
  )
    throw new Error("Invalid font asset entry");
  if (
    basename(entry.name) !== entry.name ||
    entry.name.includes("\\") ||
    !/\.(?:woff2|txt)$/.test(entry.name) ||
    !/^[a-f0-9]{64}$/.test(entry.sha256)
  )
    throw new Error("Invalid font asset path/digest");
  const path = join(projectRoot, "public/fonts/studio", entry.name);
  if (
    createHash("sha256")
      .update(await readFile(path))
      .digest("hex") !== entry.sha256
  )
    issues.push({
      file: relative(projectRoot, path),
      line: 1,
      reason: "Font or notice differs from frozen asset manifest",
    });
}
const families = new Map([
  ["Bits UI/Floating UI internals", new Set(["bits-ui", "@floating-ui/dom"])],
  ["CodeMirror 6 view internals", new Set(["@codemirror/view", "style-mod"])],
  ["Yjs/y-codemirror.next integration", new Set(["y-codemirror.next"])],
  [TERMINAL_VENDOR_FAMILY, new Set(["@xterm/xterm", "@xterm/addon-fit"])],
]);
const vendor: unknown = JSON.parse(
  await readFile(join(projectRoot, "web/styles/vendor-css.json"), "utf8"),
);
if (
  !vendor ||
  typeof vendor !== "object" ||
  !("entries" in vendor) ||
  !Array.isArray(vendor.entries) ||
  vendor.entries.length > 4
)
  throw new Error("Invalid vendor CSS allowlist");
const seen = new Set<string>();
for (const entry of vendor.entries) {
  if (
    !entry ||
    typeof entry !== "object" ||
    !("family" in entry) ||
    typeof entry.family !== "string" ||
    !families.has(entry.family) ||
    seen.has(entry.family) ||
    !("packages" in entry) ||
    !Array.isArray(entry.packages) ||
    !entry.packages.length ||
    !("sources" in entry) ||
    !Array.isArray(entry.sources) ||
    !entry.sources.length
  )
    throw new Error("Invalid vendor CSS family");
  seen.add(entry.family);
  if (entry.family === TERMINAL_VENDOR_FAMILY) {
    const failures = terminalVendorProblems(entry);
    if (failures.length) throw new Error(failures.join("; "));
    for (const artifact of TERMINAL_ARTIFACTS) {
      const bytes = await readFile(
        join(projectRoot, "node_modules", artifact.path),
      );
      if (!terminalArtifactMatches(artifact.path, bytes))
        throw new Error(`Terminal artifact changed: ${artifact.path}`);
    }
  }
  const declared = new Set<string>();
  for (const dependency of entry.packages) {
    if (
      !dependency ||
      typeof dependency !== "object" ||
      !("name" in dependency) ||
      typeof dependency.name !== "string" ||
      !families.get(entry.family)?.has(dependency.name) ||
      !("version" in dependency) ||
      typeof dependency.version !== "string"
    )
      throw new Error("Invalid vendor package");
    declared.add(dependency.name);
    const installed: unknown = JSON.parse(
      await readFile(
        join(projectRoot, "node_modules", dependency.name, "package.json"),
        "utf8",
      ),
    );
    if (
      !installed ||
      typeof installed !== "object" ||
      !("version" in installed) ||
      installed.version !== dependency.version
    )
      throw new Error(`Vendor version changed: ${dependency.name}`);
  }
  for (const source of entry.sources) {
    if (
      typeof source !== "string" ||
      source.includes("..") ||
      /[*?\\]/.test(source) ||
      ![...declared].some((name) => source.startsWith(name + "/"))
    )
      throw new Error("Vendor source must name an exact dependency file");
    await readFile(join(projectRoot, "node_modules", source));
  }
}
if (issues.length) {
  for (const issue of issues)
    console.error(`${issue.file}:${issue.line}: ${issue.reason}`);
  console.error(
    `FAIL ${native ? "native increment" : "full application"} style policy: ${issues.length} violations`,
  );
  process.exitCode = 1;
} else
  console.log(
    `PASS ${native ? "native increment only (full M3 remains pending)" : "full application"} style policy: ${files.length} sources, one emitted CSS asset, font integrity verified`,
  );
