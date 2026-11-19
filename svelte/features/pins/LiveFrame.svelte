<script lang="ts">
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import {
    Globe02,
    LinkExternal01,
    RefreshCw01,
    X,
  } from "../../lib/studio/icons";
  /**
   * A live pin (kind "live", Gui #3121): an https site shown inside the room, e.g. someone's local dev through a
   * cloudflared tunnel, so the people and Claudes in an epic iterate on one page together. A floating window over
   * the room (full screen on phones). The page is another origin in a sandbox, so it never reaches deco.chat's
   * cookies or APIs; the strip on top says it is an outside site, whose, and who pinned it.
   */
  let {
    href,
    host,
    by,
    onclose,
    t,
  }: {
    href: string;
    host: string;
    by: string;
    onclose: () => void;
    t: (text: string, vars?: Record<string, string | number>) => string;
  } = $props();
  let reload = $state(0);
</script>

<div
  data-live-frame={href}
  role="dialog"
  aria-label={t("Site externo · {host}", { host })}
  class="fixed inset-0 z-40 flex flex-col overflow-hidden bg-background font-sans text-foreground shadow-2xl md:inset-auto md:right-4 md:bottom-4 md:h-[min(640px,75vh)] md:w-[min(880px,62vw)] md:rounded-surface md:border md:border-warning/40"
>
  <div
    class="flex min-w-0 items-center gap-2 border-b border-warning/30 bg-warning/15 py-1 pr-1 pl-3 text-xs"
  >
    <Icon icon={Globe02} size={14} class="shrink-0 text-warning" />
    <span class="min-w-0 flex-1 truncate"
      ><b class="font-semibold">{t("Site externo")}</b> · {host}{by
        ? ` · ${t("fixado por {name}", { name: by })}`
        : ""}</span
    >
    <IconButton label={t("Recarregar")} onclick={() => reload++}
      ><Icon icon={RefreshCw01} /></IconButton
    >
    <a
      {href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("Abrir em nova aba")}
      title={t("Abrir em nova aba")}
      class="flex size-8 items-center justify-center rounded-lg text-foreground hover:bg-muted"
      ><Icon icon={LinkExternal01} size={16} /></a
    >
    <IconButton label={t("Fechar")} onclick={onclose}
      ><Icon icon={X} /></IconButton
    >
  </div>
  {#key reload}<iframe
      src={href}
      title={t("Site externo · {host}", { host })}
      sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
      referrerpolicy="no-referrer"
      class="min-h-0 w-full flex-1 border-0 bg-white"
    ></iframe>{/key}
</div>
