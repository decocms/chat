import { chunkDiagnostics } from "./build/chunkDiagnostics.ts";
import { serviceWorkerDevelopment } from "./build/serviceWorkerDevelopment.ts";
import tailwindcss from "@tailwindcss/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { join } from "node:path";
import { realpathSync } from "node:fs";
import {
  appDevelopment,
  workerProxy,
  workerRoutes,
} from "./build/appDevelopment.ts";
import { clientBoundary, projectRoot } from "./build/clientBoundary.ts";

const entries = (mode: string): Record<string, string> =>
  mode === "gallery"
    ? { gallery: join(import.meta.dirname, "dev/gallery.html") }
    : { index: join(import.meta.dirname, "index.html") };

export default defineConfig(({ mode, command }) => ({
  root: import.meta.dirname,
  publicDir: join(projectRoot, "public"),
  resolve: { alias: { $lib: join(projectRoot, "web/lib") } },
  // Never ship a Node `process` global or a browser process polyfill.
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      command === "serve" ? "development" : "production",
    ),
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    ...(mode === "app"
      ? {
          origin: "http://127.0.0.1:5173",
          proxy: {
            [workerRoutes]: workerProxy(
              "http://127.0.0.1:8787",
              "http://127.0.0.1:5173",
            ),
          },
        }
      : {}),
    fs: {
      allow: ["web", "shared", "public", "node_modules"].map((path) =>
        realpathSync(join(projectRoot, path)),
      ),
      deny: [
        "**/.env",
        "**/.env.*",
        "**/.dev.vars",
        "**/.dev.vars.*",
        "**/.vibebook/**",
        "**/.wrangler/**",
        "**/.api-types/**",
        "**/scripts/**",
        "**/web/build/**",
        "**/web/service-worker/**",
        "**/wrangler*.json*",
        "**/vite.config.*",
        "**/.git/**",
        "**/.ssh/**",
        "**/*.pem",
        "**/*.key",
      ],
    },
  },
  plugins: [
    ...(mode === "app"
      ? [
          appDevelopment(
            projectRoot,
            "http://127.0.0.1:8787",
            "http://127.0.0.1:5173",
          ),
          serviceWorkerDevelopment(projectRoot),
        ]
      : []),
    clientBoundary({ projectRoot }),
    tailwindcss(),
    svelte({ compilerOptions: { css: "external" } }),
    chunkDiagnostics({
      root: projectRoot,
      enabled: process.env.VIBEBOOK_CHUNK_DIAGNOSTICS === "1",
      revision: process.env.TEST_APP_REVISION,
    }),
  ],
  build: {
    // The Worker serves dist/ (wrangler.jsonc assets.directory); public/ is copied in.
    // `--mode gallery` (bun run build:gallery) builds only the component gallery into dist-gallery/, for the
    // browser tests. The gallery is never in dist/.
    outDir: join(projectRoot, mode === "gallery" ? "dist-gallery" : "dist"),
    emptyOutDir: true,
    minify: true,
    cssCodeSplit: false,
    rolldownOptions: {
      input: entries(mode),
    },
  },
}));
