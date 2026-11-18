# Technology stack

## Runtime

| Item | Use |
|---|---|
| Cloudflare Workers | All server code. Configuration in `wrangler.jsonc`. |
| Durable Objects (SQLite) | `Book` (room), `DocRoom` (document), `Person` (person). |
| D1, R2, KV | Shared index, files, OAuth. See [architecture.md](architecture.md). |
| Workers AI | Speech-to-text (`@cf/openai/whisper-large-v3-turbo`). |
| Email Sending | Sign-in codes, invites and mention emails. |
| OpenRouter | Text models and Jev (`MODEL_*` variables). |

## Languages and libraries

| Area | Libraries |
|---|---|
| Server | TypeScript, Hono, zod, `@cloudflare/workers-oauth-provider`, `y-durableobjects`, Vercel AI SDK |
| Browser | Svelte 5, TypeScript, Vite, Tailwind CSS 4, bits-ui, tailwind-variants |
| Document editor | CodeMirror 6, Yjs, y-codemirror.next, y-websocket (`collab/`) |
| Terminal | xterm.js 5.5.0 and addon-fit 0.10.0 (licenses in `public/licenses/`) |
| Landing site | TanStack Start and deco blocks (`site/`) |

## Type safety and RPC

- Write all code in TypeScript. The code is type-safe from end to end: server, wire and browser.
- All communication between the browser and the server goes through typed RPC. Do not use other kinds of requests.
  - HTTP: Hono RPC. Add the route to `src/api.ts` with a zod schema from `shared/schemas.ts`. The browser calls it through `hc<AppType>` (`svelte/lib/client/api.ts`).
  - Room WebSocket: the typed commands and events in `shared/commands.ts` and `shared/events.ts`. Each side validates the other side's messages.
  - Document text: the Yjs protocol on `/yjs/:name`. This is the only channel that is not RPC.
- Do not call `fetch` directly from the Svelte app.
- Do not use `any`, and do not use a type cast to hide a type error.
- Exception: the frozen vanilla app uses plain `fetch`. Do not copy that code.

## Frontend

- The browser app is Svelte 5 with shadcn-svelte components (`components.json`). The design system is a port of deco Studio (`@decocms/ui`) into `svelte/lib/studio/`.
- Before you make a component, look in `svelte/lib/studio/`, `svelte/lib/components/` and the feature folder. Use an existing component if possible.
- Arrange components by atomic design: atoms, then molecules, then organisms. An atom does not import a molecule. A molecule does not import an organism. The stories in `svelte/parity/stories/` use the same levels (`atoms-*`, `molecules-*`, `organisms-*`).
- Style components only with Tailwind CSS v4 utility classes. The classes have the `tw:` prefix. Use `tailwind-variants` (`tv`) for variants.
- The only authored stylesheet is `svelte/styles/tailwind.css`. Put design tokens and `@font-face` rules there.
- Do not write other CSS: no `<style>` blocks, no CSS files, no inline `style` for design.
- Do not load external CSS. The only exception is CSS that a dependency ships (for example `@xterm/xterm/css/xterm.css`). Import it in `tailwind.css`.
- Use theme tokens for colors (`tw:bg-background`, `tw:text-muted-foreground`, `tw:border-border`, …). Do not use hard-coded colors (`#hex`, `tw:bg-[#…]`, palette colors such as `tw:bg-red-500`). If no token has the correct meaning, add a token to `tailwind.css`, for light and dark.
- Use the built-in tokens of the theme before hard-coded values: breakpoints (`md`), spacing (`tw:p-4`, `tw:gap-2`), sizes (`tw:size-8`), radius (`tw:rounded-lg`), font sizes (`tw:text-sm`) and shadows. Use an arbitrary value (`tw:p-[13px]`, `tw:text-[28px]`) only if no token can do it. If you need the same arbitrary value in two places, add a token to `tailwind.css`.
- Give each clickable element `tw:cursor-pointer`. Give it `tw:cursor-not-allowed` when it is disabled.

## Screen sizes

- The app has two layouts: mobile and desktop. The theme has one breakpoint token, `md` (`--breakpoint-md: 901px` in `svelte/styles/tailwind.css`). The theme removes all other breakpoint tokens.
  - Mobile: width 900px or less. Use `tw:max-md:`.
  - Desktop: width 901px or more. Use `tw:md:`.
- Do not write a pixel breakpoint (`tw:max-[900px]:`, `tw:min-[901px]:`, other `max-[…]`/`min-[…]`). Do not use `sm:`, `lg:` or `xl:`.
- In TypeScript, use `MOBILE_QUERY` from `svelte/lib/breakpoints.ts` for `matchMedia` and `MediaQuery`. Do not write a width media query as a literal.
- To move the breakpoint, change `--breakpoint-md` and `MOBILE_QUERY` together.
- `bun run check:guidelines` fails on each of these violations.
- If a layout must change inside the desktop width, use a container query (`tw:@container`) or an automatic grid (`tw:grid-cols-[repeat(auto-fill,minmax(250px,1fr))]`). Do not add a breakpoint.
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
| `scripts/data/font-assets.json` | Source URL, size and SHA-256 of each font. The file names contain a digest prefix. Do not change a font without a new name. |
| `scripts/fixtures/entities/whatwg-entities.json` | WHATWG HTML named character references, from https://html.spec.whatwg.org/entities.json (2026-11-14, 145897 bytes, SHA-256 `d741d877…62e6`). Test data only. Do not reformat it. A test checks its digest. |
| `public/vendor/` | marked 12.0.2 and DOMPurify 3.1.6 for the vanilla app. Do not change them. |
