# Token tweaker (local only)

A floating panel to try colors for two semantic tokens, live, in the real app:

- `--vb-composer`: the message box (`ChatField`, rooms and the Home ask box).
- `--vb-user-area`: the user area at the sidebar's foot (`SidebarFoot`) and the call panel above it.

It never ships: it lives outside `web/` and is only added to a local build.

```sh
bun run build:ui && bun dev/token-tweaker/inject.ts
npx wrangler dev -c wrangler.local.jsonc --port 8941
```

To keep it across wrangler's own rebuilds, set the local config's build command to
`bun run build:ui && bun dev/token-tweaker/inject.ts`.

It shows on `localhost`/`127.0.0.1` (a "Tokens" pill at the top right), or anywhere with `?tokens=1` (opens it).
Each theme (Claro/Escuro) keeps its own choice; "Copiar CSS" gives the block to paste into `web/styles/tailwind.css`.
