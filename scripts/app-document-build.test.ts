import { expect, test } from "bun:test";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapModule, buildAppDocument } from "./build-app-document";

test("classic bootstrap rejects missing/duplicate nonces and HTML script termination", () => {
  expect(() => bootstrapModule("(()=>{})()")).toThrow("exactly one");
  expect(() =>
    bootstrapModule(
      "__VIBEBOOK_APP_DOCUMENT_NONCE____VIBEBOOK_APP_DOCUMENT_NONCE__",
    ),
  ).toThrow("exactly one");
  expect(() =>
    bootstrapModule("__VIBEBOOK_APP_DOCUMENT_NONCE__ </ScRiPt>"),
  ).toThrow("closing script");
  expect(
    bootstrapModule('const nonce="__VIBEBOOK_APP_DOCUMENT_NONCE__";'),
  ).toContain("export const appDocumentBootstrap =");
});

test("build emits the classic bootstrap string and leaves an unchanged module alone", async () => {
  const root = await mkdtemp(join(tmpdir(), "vibebook-app-document-build-"));
  try {
    await mkdir(join(root, "browser/app-document"), { recursive: true });
    await mkdir(join(root, "shared/generated"), { recursive: true });
    await writeFile(
      join(root, "browser/app-document/bootstrap.ts"),
      'window.addEventListener("message",()=>{ console.info("__VIBEBOOK_APP_DOCUMENT_NONCE__") });',
    );
    await buildAppDocument({ root });
    const path = join(root, "shared/generated/appDocumentBootstrap.ts");
    const generated = await readFile(path, "utf8");
    const json = generated.match(
      /export const appDocumentBootstrap = (.*);\n$/,
    )?.[1];
    expect(json).toBeDefined();
    const script: unknown = JSON.parse(json!);
    expect(typeof script).toBe("string");
    expect(script).not.toMatch(/\b(?:import|export)\s/);
    expect(script).toContain("__VIBEBOOK_APP_DOCUMENT_NONCE__");
    const identity = await stat(path, { bigint: true });
    await buildAppDocument({ root });
    const after = await stat(path, { bigint: true });
    expect([after.ino, after.mtimeNs]).toEqual([
      identity.ino,
      identity.mtimeNs,
    ]);
    // Native resolution must still reject a backend import.
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "src/private.ts"),
      'export const secret="backend-only"',
    );
    await writeFile(
      join(root, "browser/app-document/bootstrap.ts"),
      'import {secret} from "../../src/private"; console.info(secret, "__VIBEBOOK_APP_DOCUMENT_NONCE__");',
    );
    await expect(buildAppDocument({ root })).rejects.toThrow(
      "Browser build failed",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
