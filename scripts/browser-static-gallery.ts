import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";

/** The page that `bun run build:gallery` writes into dist-gallery/. */
export const galleryPath = "/dev/gallery.html";

/** Public built-gallery fixture only. It is not a Worker/auth/application shell. */
export async function serveBuiltGallery(directory: string) {
  const root = await realpath(directory),
    shell = await readFile(resolve(root, "." + galleryPath), "utf8"),
    entryPath = shell.match(
      /<script\b[^>]*\bsrc=["']\/(assets\/gallery-[^"']+\.js)["']/,
    )?.[1],
    cssPath = shell.match(/\bhref=["']\/(assets\/[^"']+\.css)["']/)?.[1];
  if (!entryPath || !cssPath)
    throw new Error(
      `${directory}${galleryPath} is not a built gallery (run bun run build:gallery)`,
    );
  const entry = await readFile(resolve(root, entryPath)),
    css = await readFile(resolve(root, cssPath));
  const sha = (value: Uint8Array) =>
      createHash("sha256").update(value).digest("hex"),
    version = createHash("sha256").update(entry).update(css).digest("hex");
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === galleryPath)
        return new Response(
          shell.replace(
            "<head>",
            `<head><meta name="vb-v" content="${version}" />`,
          ),
          {
            headers: {
              "content-type": "text/html",
              "cache-control": "no-store",
            },
          },
        );
      try {
        const file = await realpath(
          resolve(root, "." + decodeURIComponent(url.pathname)),
        );
        if (!file.startsWith(root + sep))
          return new Response(null, { status: 403 });
        return new Response(Bun.file(file), {
          headers: { "cache-control": "no-store" },
        });
      } catch {
        return new Response(null, { status: 404 });
      }
    },
  });
  return {
    server,
    base: `http://127.0.0.1:${server.port}`,
    proof: {
      entrySha256: sha(entry),
      cssSha256: sha(css),
      fixtureVersion: version,
      fixture:
        "Minimal public HTML plus the built gallery's Vite assets (bun run build:gallery); no Worker/API/private room",
    },
  };
}
