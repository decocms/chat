<script lang="ts">
  import type { Room } from "../../../shared/room";
  import type { SidebarBridge } from "../../sidebar";
  import { suggestionAt, threadTitle } from "../room-sidebar/model";
  import type { RoomMutations } from "../room-sidebar/session";
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
  import { cn } from "../../lib/studio/utils";
  /**
   * Where you are in the room, in the desktop top bar: the room, then the
   * open epic, suggestion or full view (board, inbox). The room crumb takes
   * you back to the main thread. On the main thread the room is the only
   * crumb (a DM: the other person), with ✎ to rename the room. An epic has
   * its actions here as buttons (EpicActions `bar`).
   */
  let {
    room,
    thread,
    owner,
    vb,
    roomIcon,
    onrenameroom,
    view = null,
    onroom,
  }: {
    room: Room;
    thread: string;
    owner: RoomMutations;
    vb: SidebarBridge;
    roomIcon?: string;
    onrenameroom(): void;
    /** A full view in the middle instead of the chat. */
    view?: "board" | "inbox" | null;
    /** Back to the main thread's chat. */
    onroom(): void;
  } = $props();
  const t = $derived(vb.t);
  const peer = $derived(dmPeer(room));
  // On the main thread's chat the room is the page; anywhere else it is a link back.
  const atRoom = $derived(!view && thread === "main");
  const epic = $derived(
    view ? undefined : room.epics.find((item) => item.id === thread),
  );
  const suggestion = $derived(view ? undefined : suggestionAt(room, thread));
  // The second crumb: the full view, or the open thread (a gone one keeps a plain label).
  const leaf = $derived(
    view === "board"
      ? t("Quadro de tarefas")
      : view === "inbox"
        ? t("Caixa de entrada")
        : (threadTitle(room, thread) ?? t("Conversa")),
  );
</script>

{#snippet roomFace()}{#if peer}<PersonAvatar
      email={peer}
      version={vb.avatarVersion(peer)}
      class="size-6"
    />{:else}<RoomMark
      title={room.book.title}
      src={roomIcon}
      class="size-6"
    />{/if}<span class="truncate">{room.book.title}</span>{/snippet}

<div
  data-vb-native
  data-room-breadcrumb
  class="@container flex min-w-0 flex-1 items-center gap-1 font-sans text-sm text-foreground"
>
  <Breadcrumb class="min-w-0 shrink pl-1">
    <BreadcrumbList class="flex-nowrap">
      <BreadcrumbItem class="shrink-[2]">
        {#if atRoom}<BreadcrumbPage
            data-room-crumb
            title={room.book.summary || room.book.title}
            class="flex items-center gap-2">{@render roomFace()}</BreadcrumbPage
          >{:else}<BreadcrumbLink data-room-crumb>
            {#snippet child({ props })}<button
                type="button"
                {...props}
                title={room.book.summary || room.book.title}
                class={cn(
                  String(props.class ?? ""),
                  // The list clips its overflow, so the focus ring is drawn inside the button.
                  "flex min-w-0 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent p-0 font-sans text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                )}
                onclick={(event) => {
                  if (event.currentTarget.isConnected) onroom();
                }}>{@render roomFace()}</button
              >{/snippet}
          </BreadcrumbLink>{/if}
      </BreadcrumbItem>
      {#if !atRoom}<BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage
            data-thread-crumb
            title={leaf}
            class="flex items-center gap-2"
            >{#if epic}<PersonAvatar
                email={epic.owner}
                version={epic.owner ? vb.avatarVersion(epic.owner) : undefined}
                class="size-6"
              />{/if}<span class="truncate">{leaf}</span></BreadcrumbPage
          >
        </BreadcrumbItem>{/if}
    </BreadcrumbList>
  </Breadcrumb>
  {#if atRoom && !room.book.dm}<IconButton
      data-room-rename
      label={t("Renomear")}
      tooltipSide="bottom"
      size="icon-sm"
      class="shrink-0 text-muted-foreground hover:text-foreground"
      onclick={(event) => {
        if (event.currentTarget.isConnected) onrenameroom();
      }}><Icon icon={Pencil01} /></IconButton
    >{/if}
  {#if suggestion}<span
      class="min-w-0 shrink-[2] truncate text-xs text-muted-foreground"
      >✦ {t("sugestão do @vibe")}</span
    >{/if}
  {#if epic}<EpicActions {epic} {room} {owner} {t} variant="bar" />{/if}
  <MutationStatus {owner} {t} />
</div>
