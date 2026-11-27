// Puts the two programs that the menu bar app (tray/) ships into tray/binaries/, with the target triple in the name
// that Tauri's bundle.externalBin needs: the vibebook CLI, compiled with Bun for the target, and herdr-core (`hc`) from
// its release, checked against the SHA-256 below. The release workflow (.github/workflows/release-tray.yml) and a
// local build both run it: bun scripts/tray-bins.ts [<target triple>] (default: this computer's).
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** herdr-core (https://herdr.dev, github.com/herdrdev/herdr-core, Apache-2.0): the `hc` terminals that the room
 *  Claudes run in (Gimenes #6147). The app uses an installed hc first. To update: change the version, then copy the
 *  digests from https://releases.herdr.dev/core/<version>/manifest.json. */
const HC_VERSION = "0.1.22";
const TARGETS = {
  "aarch64-apple-darwin": {
    bun: "bun-darwin-arm64",
    hc: "herdr-core-macos-aarch64.tar.gz",
    sha256: "90798daadefa8d126b90ef0bcdbe9c7dda9c6cfbf011a247065ab5da348f350e",
  },
  "x86_64-apple-darwin": {
    bun: "bun-darwin-x64",
    hc: "herdr-core-macos-x86_64.tar.gz",
    sha256: "35144041969e870ddb4edcd2fd08fd26dfe5cee7d18e6b48adb276f90a48aa19",
  },
  "x86_64-unknown-linux-gnu": {
    bun: "bun-linux-x64",
    hc: "herdr-core-linux-x86_64.tar.gz",
    sha256: "3054ec3992ce80c5715d721caa9dcefa6056721d15dc113f4750afce763ba5df",
  },
  "x86_64-pc-windows-msvc": {
    bun: "bun-windows-x64",
    hc: "herdr-core-windows-x86_64.zip",
    sha256: "37cae9d6c522e205efcdb55a42d354285f41b8cbb4c6e60fb505b73b151966c9",
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

// 2. herdr-core, from its release, checked before it is used. The archive has the `herdr-core` program (it answers as
// `hc` by any name), LICENSE and THIRD-PARTY-NOTICES (a folder on Windows); the notices go to
// tray/binaries/herdr-core-licenses/. On Windows, herdr-core.exe needs its conpty/ folder beside it
// (tauri.windows.conf.json ships it).
const url = `https://releases.herdr.dev/core/${HC_VERSION}/${pin.hc}`;
const res = await fetch(url);
if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
const bytes = new Uint8Array(await res.arrayBuffer());
const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
if (digest !== pin.sha256)
  throw new Error(`${pin.hc}: SHA-256 ${digest}, expected ${pin.sha256}`);
const dir = mkdtempSync(join(tmpdir(), "herdr-core-"));
const archive = join(dir, pin.hc);
await Bun.write(archive, bytes);
const unpacked = join(dir, "x");
mkdirSync(unpacked);
if (pin.hc.endsWith(".zip")) {
  if (process.platform === "win32")
    run([
      "powershell",
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${archive}' -DestinationPath '${unpacked}' -Force`,
    ]);
  else run(["unzip", "-q", archive, "-d", unpacked]);
} else run(["tar", "-xzf", archive, "-C", unpacked]);
/** The first entry with this name in the archive, at any depth (the top level first). */
function find(name: string, at = unpacked): string | undefined {
  const entries = readdirSync(at);
  if (entries.includes(name)) return join(at, name);
  for (const e of entries)
    if (statSync(join(at, e)).isDirectory()) {
      const hit = find(name, join(at, e));
      if (hit) return hit;
    }
  return undefined;
}
const program = find(`herdr-core${exe}`) ?? find(`hc${exe}`);
if (!program || !statSync(program).isFile())
  throw new Error(`${pin.hc} has no herdr-core${exe}`);
const hc = join(out, `hc-${triple}${exe}`);
cpSync(program, hc);
chmodSync(hc, 0o755);
const licenses = join(out, "herdr-core-licenses");
mkdirSync(licenses);
for (const need of ["LICENSE", "THIRD-PARTY-NOTICES"]) {
  const f = find(need);
  if (!f) throw new Error(`${pin.hc} has no ${need}`);
  cpSync(f, join(licenses, need), { recursive: true });
}
if (exe) {
  const conpty = find("conpty");
  if (!conpty) throw new Error(`${pin.hc} has no conpty`);
  cpSync(conpty, join(out, "conpty"), { recursive: true });
}
rmSync(dir, { recursive: true, force: true });
console.info(`tray/binaries: vibebook and hc ${HC_VERSION} for ${triple}`);
