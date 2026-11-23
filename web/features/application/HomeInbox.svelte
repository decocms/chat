<script lang="ts">
  import { untrack } from "svelte";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import type { ApplicationInbox } from "./inbox";
  import type { BrowserApplicationServices } from "./browser";
  import InboxControls from "./InboxControls.svelte";
  import RoomInbox from "./RoomInbox.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { homeText } from "../home/copy";
  /**
   * The home's page (`/` on a desktop, `/?inbox` on a phone): your Inbox for
   * all rooms, the same triage list as a room's (RoomInbox). It has no room, so
   * it has no scope. On a desktop its bar is a room's: the search on the left,
   * where a room has "Buscar em <sala>" (RoomHeader), then how many things wait
   * on you and "Resolve all" (phones: RoomInbox draws that itself).
   */
  let {
    owner,
    services,
  }: {
    owner: ApplicationInbox;
    services: BrowserApplicationServices;
  } = $props();
  const inbox = untrack(() => owner.state),
    t = untrack(() => services.t),
    personal = untrack(() => services.personal.state);
  const lang = $derived(services.language === "en" ? "en" : "pt");
  const waiting = $derived($personal.me?.waits.length ?? 0);
</script>

<div data-home-inbox class="flex h-full min-h-0 min-w-0 flex-col">
  <header
    class="hidden h-13 shrink-0 items-center gap-2 border-b border-border pr-3 pl-5 font-sans text-sm text-foreground md:flex"
  >
    <h2 class="sr-only">{t("Caixa de entrada")}</h2>
    <div class="flex min-w-0 flex-1 items-center">
      <button
        type="button"
        data-home-inbox-search
        class="flex h-8 w-full max-w-80 min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-muted px-2.5 text-left font-sans text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        onclick={() => services.navigation.openSearch()}
        ><Icon icon="search-md" size={14} class="shrink-0" /><span
          class="min-w-0 truncate">{homeText(lang, "searchPlaceholder")}</span
        ></button
      >
    </div>
    {#if waiting}<span
        data-home-inbox-count
        class="shrink-0 text-xs text-muted-foreground tabular-nums"
        >{homeText(lang, "waiting", { n: waiting })}</span
      >{/if}
    {#if $inbox.binding}<InboxControls
        {owner}
        binding={$inbox.binding}
        {t}
      />{/if}
  </header>
  {#if $inbox.binding}{#key $inbox.binding}<Snapshot value={$inbox.binding}
        >{#snippet children(binding)}<RoomInbox
            {owner}
            {binding}
            {services}
          />{/snippet}</Snapshot
      >{/key}{/if}
</div>
