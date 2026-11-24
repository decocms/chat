# Technology stack

## Runtime

| Item | Use |
|---|---|
| Cloudflare Workers | All server code. Configuration in `wrangler.jsonc`. |
| Durable Objects (SQLite) | `Book` (room), `DocRoom` (document), `Person` (person). |
| D1, R2, KV | Shared index, files, OAuth. See [architecture.md](architecture.md). |
| Workers AI | Speech-to-text (`@cf/openai/whisper-large-v3-turbo`). |
| Realtime SFU | Voice, camera and screen share in a room's call (`src/calls.ts`). No SDK: the Worker calls its HTTPS API. |
| Email Sending | Invites and mention emails. |
| OpenRouter | Text models and Jev (`MODEL_*` variables). |

## Languages and libraries

| Area | Libraries |
|---|---|
| Server | TypeScript, Hono, zod, `@cloudflare/workers-oauth-provider`, `y-durableobjects`, Vercel AI SDK |
| Browser | Svelte 5, TypeScript, Vite, Tailwind CSS 4, bits-ui, tailwind-variants, @dnd-kit/svelte (drag to sort) |
| Document editor | CodeMirror 6, Yjs, y-codemirror.next, y-websocket (`web/features/documents/`) |
| Call | `@mediapipe/tasks-vision` 1.2.3 (Apache 2.0): finds the person in the camera's picture for the background blur. It loads only when a person turns the blur on. |
| Terminal | xterm.js 5.5.0 and addon-fit 0.10.0 (licenses in `public/licenses/`) |

## Type safety and RPC

- Write all code in TypeScript. The code is type-safe from end to end: server, wire and browser.
- All communication between the browser and the server goes through typed RPC. Do not use other kinds of requests.
  - HTTP: Hono RPC. Add the route to `src/api.ts` with a zod schema from `shared/schemas.ts`. The browser calls it through `hc<AppType>` (`web/lib/client/api.ts`).
  - WebSockets (`/ws/:id`, `/ws-me`): JSON-RPC 2.0, with a small helper in `shared/jsonRpc.ts`. Do not add an RPC library.
    - The code uses typed tagged messages (`{ t: "doc.get", epic }`). The schemas are in `shared/commands.ts`, `shared/events.ts` and `shared/person.ts`. On the wire, `method` is `t` and `params` is the other fields.
    - A command that needs an answer is a request (`id`). The server sends one response: `result`, or `error` with a reason.
    - A command without an answer, and each event that the server pushes, is a notification (no `id`).
    - Each side validates the other side's messages.
    - The CLI hub (`vibebook listen`) connects to `/mcp?wire=jsonrpc` and gets JSON-RPC too. A CLI before 1.6.21 connects to `/mcp` and gets the old tagged JSON (`{ t, ... }`). Keep that legacy path until old CLIs are gone.
  - Document text: the Yjs protocol on `/yjs/:name`. This is the only channel that is not RPC.
- Do not call `fetch` directly from the browser app.
- Do not use `any`, and do not use a type cast to hide a type error.

## Frontend

- The browser app is Svelte 5 with shadcn-svelte components (`components.json`). The design system is a port of deco Studio (`@decocms/ui`) into `web/lib/studio/`.
- Before you make a component, look in `web/lib/studio/`, `web/lib/components/` and the feature folder. Use an existing component if possible.
- Arrange components by atomic design: atoms, then molecules, then organisms. An atom does not import a molecule. A molecule does not import an organism. The stories in `web/dev/design-system/stories/` use the same levels (`atoms-*`, `molecules-*`, `organisms-*`).
- Style components only with Tailwind CSS v4 utility classes. The classes have no prefix (`bg-card`, `md:flex`). Use `tailwind-variants` (`tv`) for variants.
- The only authored stylesheet is `web/styles/tailwind.css`. Put design tokens and `@font-face` rules there.
- Do not write other CSS: no `<style>` blocks, no CSS files, no inline `style` for design.
- Do not load external CSS. The only exception is CSS that a dependency ships (for example `@xterm/xterm/css/xterm.css`). Import it in `tailwind.css`.
- Use theme tokens for colors (`bg-background`, `text-muted-foreground`, `border-border`, …). Do not use hard-coded colors (`#hex`, `bg-[#…]`, palette colors such as `bg-red-500`). If no token has the correct meaning, add a token to `tailwind.css`, for light and dark.
- Use the built-in tokens of the theme before hard-coded values: breakpoints (`md`), spacing (`p-4`, `gap-2`), sizes (`size-8`), radius (`rounded-lg`), font sizes (`text-sm`) and shadows. Use an arbitrary value (`p-[13px]`, `text-[28px]`) only if no token can do it. If you need the same arbitrary value in two places, add a token to `tailwind.css`.
- Draw icons only with `Icon.svelte`: `<Icon icon="pencil-01" />`. The prop type is `IconName`, the Untitled UI name in kebab case.
  - All icons are in one static sprite, `web/lib/studio/icons.svg`. Vite gives it a hashed name in `dist/assets/`, so the browser caches it for one year.
  - A `<use>` to the sprite works only on the origin of the app. An icon in an iframe or an email must have its own inline SVG.
  - To add an icon, copy its path from `@untitledui/icons` into `icons.ts`. Then run `bun scripts/icon-sprite.ts`.
  - Import only the type from `icons.ts` (`import type { IconName }`). `bun run check:icons` fails on a value import.
- Give each clickable element `cursor-pointer`. Give it `cursor-not-allowed` when it is disabled.

## Screen sizes

- The app has two layouts: mobile and desktop. The theme has one breakpoint token, `md` (`--breakpoint-md: 901px` in `web/styles/tailwind.css`). The theme removes all other breakpoint tokens.
  - Mobile: width 900px or less. Use `max-md:`.
  - Desktop: width 901px or more. Use `md:`.
- Do not write a pixel breakpoint (`max-[900px]:`, `min-[901px]:`, other `max-[…]`/`min-[…]`). Do not use `sm:`, `lg:` or `xl:`.
- In TypeScript, use `MOBILE_QUERY` from `web/lib/breakpoints.ts` for `matchMedia` and `MediaQuery`. Do not write a width media query as a literal.
- To move the breakpoint, change `--breakpoint-md` and `MOBILE_QUERY` together.
- `bun run check:guidelines` fails on each of these violations.
- If a layout must change inside the desktop width, use a container query (`@container`) or an automatic grid (`grid-cols-[repeat(auto-fill,minmax(250px,1fr))]`). Do not add a breakpoint.
- When you design a new UI, design the mobile layout and the desktop layout together. Show both in the plan, and test both (390px and 1440px wide).

## Tools

- Bun 1.4.4 (pinned by `packageManager` in `package.json`). Use `bun` and `bunx`.
- TypeScript 7 (`@typescript/native`) checks the server. TypeScript 6 and `svelte-check` check the browser.
- Tests: `bun test`, happy-dom, Playwright (Chromium), axe-core.
- Prettier formats only the files in `format:check`. Most of `src/` has its own format. Do not reformat those files.

## Rules for dependencies

1. Add a dependency only if the platform or the code cannot do it in a small amount of work.
2. Pin the exact version for browser and security code.
3. Do not add a dependency that the browser bundle does not need into the browser.
4. Record each new dependency in `agents_deliberate_decisions.md`.

## Third-party assets

| Asset | Source and license |
|---|---|
| `public/fonts/studio/InterVariable*.woff2` | Inter, SIL Open Font License 1.1. Keep `Inter-LICENSE.txt`. |
| `public/fonts/studio/CommitMono-*.woff2` | Commit Mono, SIL Open Font License 1.1. Keep `CommitMono-LICENSE.txt`. |
| `web/lib/studio/icons.ts` | Untitled UI icons, MIT, from `@untitledui/icons` 0.0.23 (`d` of each path, copied, not a dependency). Names that start with `app-` are our own drawings. |
| `public/vendor/mediapipe/selfie_segmenter.tflite` | MediaPipe selfie segmenter (float16), Apache 2.0, from https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite (2026-11-24, 249537 bytes, SHA-256 `191ac952…658b`). License in `public/licenses/`. |
| `web/lib/studio/icons.ts`: `microphone-off-01`, `monitor-01`, `video-recorder`, `video-recorder-off` | Untitled UI icons 0.0.23, MIT, copied as the other icons. |
| `scripts/data/font-assets.json` | Source URL, size and SHA-256 of each font. The file names contain a digest prefix. Do not change a font without a new name. |
| `scripts/fixtures/entities/whatwg-entities.json` | WHATWG HTML named character references, from https://html.spec.whatwg.org/entities.json (2026-11-14, 145897 bytes, SHA-256 `d741d877…62e6`). Test data only. Do not reformat it. A test checks its digest. |
