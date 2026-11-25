// Puts the two programs that the menu bar app (tray/) ships into tray/binaries/, with the target triple in the name
// that Tauri's bundle.externalBin needs: the vibebook CLI, compiled with Bun for the target, and herdr from herdr's
// GitHub release, checked against the SHA-256 below. The release workflow (.github/workflows/release-tray.yml) and a
// local build both run it: bun scripts/tray-bins.ts [<target triple>] (default: this computer's).
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** herdr (https://herdr.dev, github.com/herdrdev/herdr, Apache-2.0). To update: change the version, then copy the
 *  digests from `gh release view --repo herdrdev/herdr v<version> --json assets`. */
const HERDR_VERSION = "0.9.5";
const TARGETS = {
  "aarch64-apple-darwin": {
    bun: "bun-darwin-arm64",
    herdr: "herdr-macos-aarch64",
    sha256: "fb77c2232a05a8035421382c894392f4174e4e38a18e48af3dd0290157c3a7e2",
  },
  "x86_64-apple-darwin": {
    bun: "bun-darwin-x64",
    herdr: "herdr-macos-x86_64",
    sha256: "5fb0a908ec7f6745e3e245738b06bfad56c46391c391ab3c0955fbead01f1369",
  },
  "x86_64-unknown-linux-gnu": {
    bun: "bun-linux-x64",
    herdr: "herdr-linux-x86_64",
    sha256: "14d9e8bc8b4a9e0118d77c32266f76d461f09b40342eb23752960bd89f59929d",
  },
  "x86_64-pc-windows-msvc": {
    bun: "bun-windows-x64",
    herdr: "herdr-windows-x86_64.zip",
    sha256: "d2c6c9c971c43a0bfdde8c692a9a1a7a45c3e4807cd01ae45662b4734fac1cbf",
  },
} as const;
type Target = keyof typeof TARGETS;

const root = join(import.meta.dir, "..");
const out = join(root, "tray", "binaries");

function run(cmd: string[]) {
  const r = Bun.spawnSync(cmd, {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (r.exitCode !== 0) throw new Error(`failed: ${cmd.join(" ")}`);
}

function hostTriple(): string {
  const r = Bun.spawnSync(["rustc", "-vV"]);
  const host = /^host: (\S+)$/m.exec(r.stdout.toString())?.[1];
  if (!host)
    throw new Error(
      "rustc -vV did not print the host triple. Install Rust, or name the target.",
    );
  return host;
}

const isTarget = (t: string): t is Target => t in TARGETS;
const triple = process.argv[2] ?? hostTriple();
if (!isTarget(triple))
  throw new Error(
    `unknown target ${triple}. Known: ${Object.keys(TARGETS).join(", ")}`,
  );
const pin = TARGETS[triple];
const exe = triple.includes("windows") ? ".exe" : "";

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// 1. The CLI. In the bundle it is next to the app's executable, without the triple (tray/src/main.rs runs it).
run([
  "bun",
  "build",
  "cli/vibebook.ts",
  "--compile",
  `--target=${pin.bun}`,
  "--outfile",
  join(out, `vibebook-${triple}${exe}`),
]);

// 2. herdr, from its release, checked before it is used.
const url = `https://github.com/herdrdev/herdr/releases/download/v${HERDR_VERSION}/${pin.herdr}`;
const res = await fetch(url);
if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
const bytes = new Uint8Array(await res.arrayBuffer());
const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
if (digest !== pin.sha256)
  throw new Error(`${pin.herdr}: SHA-256 ${digest}, expected ${pin.sha256}`);
const herdr = join(out, `herdr-${triple}${exe}`);
if (pin.herdr.endsWith(".zip")) {
  // Windows: herdr.exe needs its conpty/ folder beside it; tauri.windows.conf.json ships it and the notices.
  const dir = mkdtempSync(join(tmpdir(), "herdr-"));
  const zip = join(dir, pin.herdr);
  await Bun.write(zip, bytes);
  const unzipped = join(dir, "x");
  if (process.platform === "win32")
    run([
      "powershell",
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${unzipped}' -Force`,
    ]);
  else run(["unzip", "-q", zip, "-d", unzipped]);
  for (const need of ["herdr.exe", "conpty", "THIRD-PARTY-NOTICES"])
    if (!existsSync(join(unzipped, need)))
      throw new Error(`${pin.herdr} has no ${need}`);
  cpSync(join(unzipped, "herdr.exe"), herdr);
  cpSync(join(unzipped, "conpty"), join(out, "conpty"), { recursive: true });
  cpSync(
    join(unzipped, "THIRD-PARTY-NOTICES"),
    join(out, "THIRD-PARTY-NOTICES"),
    { recursive: true },
  );
  rmSync(dir, { recursive: true, force: true });
} else {
  await Bun.write(herdr, bytes);
  chmodSync(herdr, 0o755);
}
console.info(
  `tray/binaries: vibebook and herdr ${HERDR_VERSION} for ${triple}`,
);
