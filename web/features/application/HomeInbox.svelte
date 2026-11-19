<script lang="ts">
  import { untrack } from "svelte";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import type { ApplicationInbox } from "./inbox";
  import type { BrowserApplicationServices } from "./browser";
  import InboxControls from "./InboxControls.svelte";
  import RoomInbox from "./RoomInbox.svelte";
  /**
   * The home's page at `/?inbox`: your Inbox for all rooms, the same triage
   * list as a room's (RoomInbox). It has no room, so it has no scope; the bar
   * names it and holds "Resolve all" (phones: RoomInbox draws that itself).
   */
  let {
    owner,
    services,
  }: {
    owner: ApplicationInbox;
    services: BrowserApplicationServices;
  } = $props();
  const inbox = untrack(() => owner.state),
    t = untrack(() => services.t);
</script>

<div data-home-inbox class="flex h-full min-h-0 min-w-0 flex-col">
  <header
    class="hidden h-13 shrink-0 items-center gap-2 border-b border-border pr-3 pl-5 font-sans text-sm text-foreground md:flex"
  >
    <h2 class="m-0 min-w-0 flex-1 truncate text-sm font-semibold">
      {t("Caixa de entrada")}
    </h2>
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
