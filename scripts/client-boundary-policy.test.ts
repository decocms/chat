import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClientBoundaryPolicy } from "../svelte/build/clientBoundary";

let root: string;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "vb-production-policy-"));
  for (const path of [
    "client",
    ".wrangler/qa-test",
    "scripts",
    "svelte/build",
    "shared",
    "node_modules/package/scripts",
  ])
    await mkdir(join(root, path), { recursive: true });
  await writeFile(
    join(root, ".wrangler/qa-test/index.js"),
    "SYNTHETIC_BACKEND_BUNDLE",
  );
  await writeFile(join(root, "scripts/build.ts"), "SYNTHETIC_BUILD_TOOL");
  await symlink(
    join(root, ".wrangler/qa-test/index.js"),
    join(root, "shared/font.woff2"),
  );
  await symlink(join(root, "scripts/build.ts"), join(root, "shared/tool.ts"));
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

test("shared browser policy refuses generated backend strings, tooling and symlink assets", () => {
  const { assertClient } = createClientBoundaryPolicy({ projectRoot: root });
  for (const path of [
    ".wrangler/qa-test/index.js",
    ".wrangler/tmp/bundle.js",
    ".api-types/src/api.d.ts",
    "scripts/build.ts",
    "cli/vibebook.ts",
    "svelte/build/uiVersion.ts",
    "svelte/vite.config.ts",
    "svelte/tsconfig.json",
    "wrangler.qa.jsonc",
    "wrangler.toml",
    "shared/private.key",
    "shared/private.pem",
    "package.json",
    "shared/font.woff2",
    "shared/tool.ts",
  ])
    for (const query of ["", "?raw", "?url"])
      expect(() => assertClient(join(root, path) + query)).toThrow(
        "[client-boundary]",
      );
  expect(() =>
    assertClient("../scripts/build.ts?raw", join(root, "client/main.ts")),
  ).toThrow("[client-boundary]");
});

test("browser roots, temporary entries and package-internal tooling names remain valid", () => {
  const { assertClient } = createClientBoundaryPolicy({ projectRoot: root });
  for (const path of [
    "client/main.ts",
    "shared/value.ts",
    "shared/.browser-value.ts",
    "svelte/Chat.svelte",
    "collab/editor.ts",
    "mcp-app/app.ts",
    "public/vendor.js",
    "node_modules/package/scripts/browser.js",
    "node_modules/package/vite.config.js",
  ])
    expect(() => assertClient(join(root, path))).not.toThrow();
});

test("whole project-root aliases retain lexical and physical backend/tooling denial, including missing targets", async () => {
  const { realpath } = await import("node:fs/promises");
  const alias = `${root}-project-alias`;
  await symlink(root, alias);
  try {
    const physical = await realpath(root);
    const policy = createClientBoundaryPolicy({ projectRoot: alias });
    for (const base of [root, alias, physical]) {
      for (const path of [
        "src/not-created.ts",
        "scripts/build.ts",
        "scripts/not-created.ts",
        "cli/not-created.ts",
        "svelte/build/not-created.ts",
        "svelte/vite.config.ts",
        "package.json",
        ".wrangler/not-created/worker.js",
        "shared/private.key",
        "shared/font.woff2",
        "shared/tool.ts",
      ])
        for (const query of ["", "?raw", "?url"])
          expect(() => policy.assertClient(join(base, path) + query)).toThrow(
            "[client-boundary]",
          );
      expect(() =>
        policy.assertClient(
          "../scripts/not-created.ts?raw",
          join(base, "client/main.ts"),
        ),
      ).toThrow("[client-boundary]");
      expect(() =>
        policy.assertClient(join(base, "shared/value.ts")),
      ).not.toThrow();
      expect(() =>
        policy.assertClient(
          join(base, "node_modules/package/scripts/browser.js"),
        ),
      ).not.toThrow();
    }
  } finally {
    await rm(alias, { force: true });
  }
});

test("a checkout under .claude/worktrees passes; its own .claude/ and private files still fail", async () => {
  const checkout = join(root, "home/.claude/worktrees/x");
  const fixture = join(root, "fixture");
  for (const path of ["node_modules/pkg/.cache", ".claude", "shared", "src"])
    await mkdir(join(checkout, path), { recursive: true });
  await mkdir(join(fixture, "client"), { recursive: true });
  await writeFile(join(checkout, "node_modules/pkg/index.css"), "");
  // The checkout is the project.
  const project = createClientBoundaryPolicy({ projectRoot: checkout });
  for (const path of [
    "shared/value.ts",
    "svelte/Chat.svelte",
    "node_modules/pkg/index.css",
  ])
    expect(() => project.assertClient(join(checkout, path))).not.toThrow();
  for (const path of [
    ".claude/settings.json",
    ".claude/worktrees/y/shared/value.ts",
    ".dev.vars",
    "src/index.ts",
    "node_modules/pkg/.cache/value.js",
  ])
    expect(() => project.assertClient(join(checkout, path))).toThrow(
      "[client-boundary]",
    );
  // A temp fixture that reads the checkout's packages.
  const borrowed = createClientBoundaryPolicy({
    projectRoot: fixture,
    dependencyRoots: [checkout],
  });
  expect(() =>
    borrowed.assertClient(
      join(checkout, "node_modules/pkg/index.css"),
      join(fixture, "client/main.ts"),
    ),
  ).not.toThrow();
  for (const path of [
    ".claude/settings.json",
    "shared/value.ts",
    "node_modules/pkg/.cache/value.js",
  ])
    expect(() => borrowed.assertClient(join(checkout, path))).toThrow(
      "[client-boundary]",
    );
  // Undeclared, the same package path keeps failing closed.
  expect(() =>
    createClientBoundaryPolicy({ projectRoot: fixture }).assertClient(
      join(checkout, "node_modules/pkg/index.css"),
    ),
  ).toThrow("[client-boundary]");
});
