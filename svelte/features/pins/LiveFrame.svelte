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
   * the room (full screen on phones). The page is another origin in a sandbox, so it never reaches vibebook's
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
  data-vb-native
  data-live-frame={href}
  role="dialog"
  aria-label={t("Site externo · {host}", { host })}
  class="tw:fixed tw:inset-0 tw:z-40 tw:flex tw:flex-col tw:overflow-hidden tw:bg-background tw:font-sans tw:text-foreground tw:shadow-2xl tw:sm:inset-auto tw:sm:right-4 tw:sm:bottom-4 tw:sm:h-[min(640px,75vh)] tw:sm:w-[min(880px,62vw)] tw:sm:rounded-surface tw:sm:border tw:sm:border-warning/40"
>
  <div
    class="tw:flex tw:min-w-0 tw:items-center tw:gap-2 tw:border-b tw:border-warning/30 tw:bg-warning/15 tw:py-1 tw:pr-1 tw:pl-3 tw:text-xs"
  >
    <Icon icon={Globe02} size={14} class="tw:shrink-0 tw:text-warning" />
    <span class="tw:min-w-0 tw:flex-1 tw:truncate"
      ><b class="tw:font-semibold">{t("Site externo")}</b> · {host}{by
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
      class="tw:flex tw:size-8 tw:items-center tw:justify-center tw:rounded-lg tw:text-foreground tw:hover:bg-muted"
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
      class="tw:min-h-0 tw:w-full tw:flex-1 tw:border-0 tw:bg-white"
    ></iframe>{/key}
</div>
