<script lang="ts">
  import type { ThreadHeaderProps } from "./types";
  import { suggestionAt } from "./model";
  import EpicActions from "./EpicActions.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import { ChevronDown } from "../../lib/studio/icons";
  import MutationStatus from "./MutationStatus.svelte";
  /**
   * The open thread's title in the phone's thread sheet, with the epic's
   * actions behind "⋯". The desktop top bar has RoomBreadcrumb instead.
   */
  let { room, thread, owner, vb, onopenside, titleId }: ThreadHeaderProps =
    $props();
  const epic = $derived(room.epics.find((item) => item.id === thread));
  const suggestion = $derived(suggestionAt(room, thread));
  const title = $derived(suggestion?.title ?? epic?.title ?? room.book.title);
</script>

<div
  data-vb-native
  data-native-thread-header
  class="flex min-w-0 flex-1 flex-nowrap items-center gap-1 font-sans text-sm tracking-normal text-foreground"
>
  <h2 class="m-0 min-w-0 overflow-hidden text-sm font-medium">
    <Button
      id={titleId}
      variant="ghost"
      size="sm"
      class="max-w-full min-w-0 justify-start px-2 text-sm font-medium"
      title={room.book.summary || title}
      onclick={(event) => {
        if (event.currentTarget.isConnected) onopenside();
      }}><span class="truncate">{title}</span></Button
    >
  </h2>
  <IconButton
    label={vb.t("Trocar de conversa")}
    class="md:hidden"
    onclick={(event) => {
      if (event.currentTarget.isConnected) onopenside();
    }}><Icon icon={ChevronDown} /></IconButton
  >
  {#if suggestion}<span
      class="min-w-0 shrink-[2] truncate text-xs text-muted-foreground"
      >✦ {vb.t("sugestão do @vibe")}</span
    >{:else if room.book.folder && !epic}<span
      class="min-w-0 shrink-[2] truncate text-xs text-muted-foreground"
      >{room.book.folder}</span
    >{/if}
  {#if epic}<EpicActions {epic} {room} {owner} t={vb.t} variant="menu" />{/if}
  <MutationStatus {owner} t={vb.t} />
</div>
