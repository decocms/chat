<script lang="ts">
  import type { ThreadHeaderProps } from "../room-sidebar/types";
  import { suggestionAt } from "../room-sidebar/model";
  import EpicActions from "../room-sidebar/EpicActions.svelte";
  import MutationStatus from "../room-sidebar/MutationStatus.svelte";
  import RoomMark from "../room-sidebar/RoomMark.svelte";
  import { dmPeer } from "../room-scope/model";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import Breadcrumb from "../../lib/studio/Breadcrumb.svelte";
  import BreadcrumbItem from "../../lib/studio/BreadcrumbItem.svelte";
  import BreadcrumbLink from "../../lib/studio/BreadcrumbLink.svelte";
  import BreadcrumbList from "../../lib/studio/BreadcrumbList.svelte";
  import BreadcrumbPage from "../../lib/studio/BreadcrumbPage.svelte";
  import BreadcrumbSeparator from "../../lib/studio/BreadcrumbSeparator.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import { Pencil01 } from "../../lib/studio/icons";
  /**
   * Where you are in the room, in the desktop top bar: the room, then the
   * open epic, suggestion or full view (board, inbox). The room crumb takes
   * you back to the main thread. On the main thread the room is the only
   * crumb (a DM: the other person), with ✎ to rename the room. An epic has
   * its actions here as buttons (EpicActions `bar`).
   */
  let {
    header,
    view = null,
    onroom,
  }: {
    header: ThreadHeaderProps;
    /** A full view in the middle instead of the chat. */
    view?: "board" | "inbox" | null;
    /** Back to the main thread's chat. */
    onroom(): void;
  } = $props();
  const room = $derived(header.room),
    t = $derived(header.vb.t);
  const peer = $derived(dmPeer(room));
  const epic = $derived(
    view ? undefined : room.epics.find((item) => item.id === header.thread),
  );
  const suggestion = $derived(
    view ? undefined : suggestionAt(room, header.thread),
  );
  // The second crumb: the full view, or the open epic or suggestion.
  const leaf = $derived(
    view === "board"
      ? t("Quadro de tarefas")
      : view === "inbox"
        ? t("Caixa de entrada")
        : (suggestion?.title ?? epic?.title ?? ""),
  );
</script>

{#snippet roomFace()}{#if peer}<PersonAvatar
      email={peer}
      version={header.vb.avatarVersion(peer)}
      class="size-6"
    />{:else}<RoomMark
      title={room.book.title}
      src={header.roomIcon}
      class="size-6"
    />{/if}{/snippet}

<div
  data-vb-native
  data-room-breadcrumb
  class="flex min-w-0 flex-1 items-center gap-1 font-sans text-sm text-foreground"
>
  <Breadcrumb class="min-w-0 shrink pl-1">
    <BreadcrumbList class="flex-nowrap">
      <BreadcrumbItem class="shrink-[2]">
        {#if leaf}<BreadcrumbLink data-room-crumb>
            {#snippet child({ props })}<button
                type="button"
                {...props}
                title={room.book.summary || room.book.title}
                class="{props.class} flex min-w-0 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent p-0 font-sans text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onclick={(event) => {
                  if (event.currentTarget.isConnected) onroom();
                }}
                >{@render roomFace()}<span class="truncate"
                  >{room.book.title}</span
                ></button
              >{/snippet}
          </BreadcrumbLink>{:else}<BreadcrumbPage
            data-room-crumb
            title={room.book.summary || room.book.title}
            class="flex items-center gap-2"
            >{@render roomFace()}<span class="truncate">{room.book.title}</span
            ></BreadcrumbPage
          >{/if}
      </BreadcrumbItem>
      {#if leaf}<BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage
            data-thread-crumb
            title={leaf}
            class="flex items-center gap-2"
            >{#if epic}<PersonAvatar
                email={epic.owner}
                version={epic.owner
                  ? header.vb.avatarVersion(epic.owner)
                  : undefined}
                class="size-6"
              />{/if}<span class="truncate">{leaf}</span></BreadcrumbPage
          >
        </BreadcrumbItem>{/if}
    </BreadcrumbList>
  </Breadcrumb>
  {#if !leaf && !room.book.dm}<IconButton
      data-room-rename
      label={t("Renomear")}
      tooltipSide="bottom"
      size="icon-sm"
      class="shrink-0 text-muted-foreground hover:text-foreground"
      onclick={(event) => {
        if (event.currentTarget.isConnected) header.onrenameroom();
      }}><Icon icon={Pencil01} /></IconButton
    >{/if}
  {#if suggestion}<span
      class="min-w-0 shrink-[2] truncate text-xs text-muted-foreground"
      >✦ {t("sugestão do @vibe")}</span
    >{/if}
  {#if epic}<EpicActions
      {epic}
      {room}
      owner={header.owner}
      {t}
      variant="bar"
    />{/if}
  <MutationStatus owner={header.owner} {t} />
</div>
