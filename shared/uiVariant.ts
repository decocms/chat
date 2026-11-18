export type UiVariant = "vanilla" | "svelte";

/** Svelte is the default since Nov 2026; vanilla stays as the fallback (`?ui=vanilla`, the `vb_ui` cookie, or the
 *  Worker var `UI_DEFAULT=vanilla` for everyone). */
export const DEFAULT_UI: UiVariant = "svelte";
/** Set by `/ui/vanilla` (the "Nova UI" switch turned off); `/ui/svelte` clears it. Only this device. */
export const UI_COOKIE = "vb_ui";

/** The variant a URL asks for: `?ui=` when present, else the default. The Worker writes the resolved `ui` into every
 *  page request (src/ui-select.ts), so on the server a page URL always carries it. */
export function uiVariant(url: string | URL): UiVariant {
  const ui = new URL(url).searchParams.get("ui");
  return ui === "vanilla" || ui === "svelte" ? ui : DEFAULT_UI;
}

export function uiShellPath(url: string | URL): "/app" | "/app-svelte" {
  return uiVariant(url) === "svelte" ? "/app-svelte" : "/app";
}

/** Keep vanilla's marker on app navigation (the default needs none), without touching API or external URLs. */
export function uiNavigationUrl(
  target: string | URL,
  current: string | URL,
  variant: UiVariant,
): string {
  const base = new URL(current);
  const url = new URL(target, base);
  if (
    url.origin !== base.origin ||
    !/^\/(?:app|archived|login|b\/[a-z0-9]+)\/?$/.test(url.pathname)
  )
    return String(target);
  if (variant === DEFAULT_UI) url.searchParams.delete("ui");
  else url.searchParams.set("ui", variant);
  return url.pathname + url.search + url.hash;
}

/** Where the "Nova UI" switch goes: stores the choice on this device, then back to the same page. */
export function uiSwitchUrl(variant: UiVariant, current: string | URL): string {
  const url = new URL(current);
  url.searchParams.delete("ui");
  return `/ui/${variant}?next=${encodeURIComponent(url.pathname + url.search + url.hash)}`;
}
