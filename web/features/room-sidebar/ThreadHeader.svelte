<script lang="ts">
  import type { ThreadHeaderProps } from "./types";
  import EpicActions from "./EpicActions.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import MutationStatus from "./MutationStatus.svelte";
  /**
   * The open epic's title in the phone's thread sheet, with its status pill
   * under it. A tap on the title closes the sheet. The desktop top bar has
   * RoomBarTitle instead.
   */
  let {
    room,
    thread,
    owner,
    vb,
    onopenside,
    titleId,
  }: Pick<
    ThreadHeaderProps,
    "room" | "thread" | "owner" | "vb" | "onopenside" | "titleId"
  > = $props();
  const epic = $derived(room.epics.find((item) => item.id === thread));
</script>

{#if epic}<div
    data-thread-header
    class="flex min-w-0 flex-1 flex-col font-sans text-sm tracking-normal text-foreground"
  >
    <div class="flex min-w-0 flex-nowrap items-center gap-1">
      <h2 class="m-0 min-w-0 overflow-hidden text-sm font-medium">
        <Button
          id={titleId}
          variant="ghost"
          size="sm"
          class="max-w-full min-w-0 justify-start px-2 text-sm font-medium"
          title={epic.title}
          onclick={(event) => {
            if (event.currentTarget.isConnected) onopenside();
          }}><span class="truncate">{epic.title}</span></Button
        >
      </h2>
      <IconButton
        label={vb.t("Trocar de conversa")}
        onclick={(event) => {
          if (event.currentTarget.isConnected) onopenside();
        }}><Icon icon="chevron-down" /></IconButton
      >
      <MutationStatus {owner} t={vb.t} />
    </div>
    <EpicActions {epic} {owner} t={vb.t} variant="sheet" />
  </div>{/if}
