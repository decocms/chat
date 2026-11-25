<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import DmNav from "../app-navigation/DmNav.svelte";
  import SidebarFoot from "../app-navigation/SidebarFoot.svelte";
  import SidebarHeader from "../../lib/components/SidebarHeader.svelte";
  import { navRow } from "../../lib/components/navRow";
  import EpicTree from "../navigation/EpicTree.svelte";
  import PinnedItems from "../pins/PinnedItems.svelte";
  import RoomMark from "./RoomMark.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { studioType } from "../../lib/components/type";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Progress from "../../lib/studio/Progress.svelte";
  import { cn } from "../../lib/studio/utils";
  import WaitBadge from "../waits/WaitBadge.svelte";
  import Count from "../../lib/components/Count.svelte";
  import AgentPresenceRows from "./AgentPresenceRows.svelte";
  import MutationStatus from "./MutationStatus.svelte";
  import { createRoomMutations } from "./session";
  import { dmPeer } from "../room-scope/model";
  import type { SidebarProps } from "../../app/sidebar";
  let {
    appNavigation,
    room,
    thread,
    friends = [],
    vb,
    send,
    request,
    onopen,
    ondonechange,
    navigation,
    pins,
    onopenpinfile,
    onopenpinapp,
    activePinApp,
    collapsed = false,
    roomIcon,
    locale,
    mutations,
    presence = { agents: [], sandboxes: [] },
    ontogglerail = () => {},
    onrenameroom = () => {},
    onopenside = () => {},
    mountSheetHandle,
    hideSheetHandle = false,
    phoneMenu,
    phoneAccount,
    footer,
    call,
  }: SidebarProps = $props();
  const external = untrack(() => !!mutations);
  // A DM (src/dm.ts): its sidebar is your DM list; the DM is only a conversation (no threads, views or epics).
  const dm = $derived(!!room.book.dm);
  const peer = $derived(dmPeer(room));
  const owner = untrack(
    () => mutations ?? createRoomMutations(room.me, room.id),
  );
  let active = true;
  let root = $state<HTMLElement | null>(null);
  $effect(() => owner.sync(room, request));
  onDestroy(() => {
    active = false;
    if (!external) owner.dispose();
  });
  function open(id: string) {
    if (active) onopen(id);
  }
  // The room's name (desktop) and the room's row (phones) open the main thread.
  function openMain() {
    open("main");
  }
  function sheetHandle(node: HTMLElement) {
    return { destroy: mountSheetHandle?.(node) };
  }
</script>

<section
  bind:this={root}
  data-room-sidebar-panel
  class={cn(
    studioType,
    "flex h-full min-h-[32rem] flex-col overflow-x-hidden bg-sidebar p-2 text-sm leading-5 text-sidebar-foreground",
    // Expanded, the sections take their full height and the sidebar scrolls whole.
    // A phone's title menu keeps its shortcuts and the room's row in place:
    // only the epics scroll (Gimenes #3775).
    collapsed
      ? "items-center gap-2 overflow-y-auto overscroll-contain"
      : "gap-6 overflow-y-auto overscroll-contain max-md:min-h-0 max-md:overflow-y-hidden",
  )}
>
  {#if collapsed}
    <IconButton
      label={vb.t("Abrir menu")}
      tooltipSide="right"
      size="icon"
      aria-expanded="false"
      onclick={ontogglerail}><Icon icon="layout-left" /></IconButton
    >
    <IconButton
      href="/"
      data-nav
      label={vb.t("Suas salas")}
      tooltipSide="right"
      size="icon"><Icon icon="arrow-left" /></IconButton
    >
    {#if call}{@render call(true)}{/if}
    {#each [{ id: "main", title: room.book.title, tasks: [], owner: undefined }, ...room.epics.filter((epic) => !epic.done || epic.id === thread)] as epic (epic.id)}
      {@const done = epic.tasks.filter((task) => task.done).length}
      <Button
        variant={thread === epic.id ? "secondary" : "ghost"}
        class="relative h-auto flex-col gap-1 rounded-lg p-1"
        aria-current={thread === epic.id ? "page" : undefined}
        title={epic.title}
        onclick={(event) => {
          if (event.currentTarget.isConnected) open(epic.id);
        }}
        >{#if epic.id === "main" && peer}<PersonAvatar
            email={peer}
            version={vb.avatarVersion(peer)}
            class="size-7"
          />{:else if epic.id === "main"}<RoomMark
            title={room.book.title}
            src={roomIcon}
            class="size-7"
          />{:else}<PersonAvatar
            email={epic.owner}
            version={epic.owner ? vb.avatarVersion(epic.owner) : undefined}
            class="size-7"
          />{/if}{#if epic.tasks.length}<Progress
            value={(done / epic.tasks.length) * 100}
            aria-label={vb.t("Tarefas")}
            class="h-1 w-7"
          />{/if}<WaitBadge
          solid
          waits={vb.waitsIn(epic.id)}
          label={(n) => vb.t("{n} coisas esperando você", { n })}
          class="absolute -top-1 -right-1"
        /></Button
      >
    {/each}
    <!-- No + for a new thread (Gimenes #4286): a thread starts from a message. -->
    {#if room.requests?.length}<Button
        variant="outline"
        size="sm"
        title={vb.t("{n} pedindo pra entrar", { n: room.requests.length })}
        onclick={ontogglerail}>+{room.requests.length}</Button
      >{/if}
    {#each room.members.slice(0, 8) as email}<span
        role="img"
        aria-label={`${vb.name(email)}${room.online.includes(email) ? ` · ${vb.t("online")}` : ""}`}
        class={room.online.includes(email)
          ? "relative flex rounded-full ring-2 ring-brand"
          : "relative flex rounded-full"}
        ><PersonAvatar
          {email}
          version={vb.avatarVersion(email)}
          class="size-7"
        /></span
      >{/each}
    <MutationStatus {owner} t={vb.t} />
    {#if footer}<div class="mt-auto shrink-0 pt-2 max-md:hidden">
        {@render footer(true)}
      </div>{/if}
  {:else}
    {#if !hideSheetHandle}<button
        type="button"
        use:sheetHandle
        aria-label={vb.t("Fechar")}
        class="mx-auto h-5 w-12 shrink-0 cursor-pointer rounded-full border-0 bg-muted md:hidden"
        onclick={onopenside}
      ></button>{/if}
    <!-- Phones: the room's name is the drawer's first item (Gimenes #4065). -->
    {#if !dm}{@render roomRow()}{/if}
    {#if phoneMenu}<div class="-mb-2 shrink-0 md:hidden">
        {@render phoneMenu()}
      </div>{/if}
    <!-- No This room | All rooms tabs: the phone's Home lists every room (Gimenes #4071). -->
    {@render thisRoom()}
    {#snippet thisRoom()}{#if dm && appNavigation}<!-- A DM is only a conversation: its row, no threads, views or epics under it. -->
        <DmNav
          controller={appNavigation.controller}
          lang={appNavigation.lang}
        />{:else}<!-- Its full height, like Pinned and People below: the sidebar scrolls whole (one scroll, never two). -->
        <div class="flex shrink-0 flex-col gap-3 max-md:min-h-0 max-md:shrink">
          <!-- Desktop: the room's name on top is the main thread (Gimenes #3989), a ghost button (#4007) with what waits on you; ✎ on hover. Phones have the room's row at the top of the drawer. -->
          <SidebarHeader class="group/name max-md:hidden"
            ><Button
              variant="ghost"
              data-room-home
              aria-current={thread === "main" ? "page" : undefined}
              class="h-9 min-w-0 flex-1 justify-start px-2 text-left text-sidebar-foreground hover:bg-sidebar-accent"
              title={room.book.summary
                ? `${room.book.title}\n${room.book.summary}`
                : room.book.title}
              onclick={(event) => {
                if (event.currentTarget.isConnected) openMain();
              }}
            >
              <RoomMark title={room.book.title} src={roomIcon} />
              <h2 class="m-0 min-w-0 flex-1 truncate text-sm font-semibold">
                {room.book.title}
              </h2>
              <WaitBadge
                waits={vb.waitsIn("main")}
                label={(n) => vb.t("{n} coisas esperando você", { n })}
              />
            </Button>
            <!-- The same hover and height as the room's name beside it (Gimenes #4035). -->
            <IconButton
              label={vb.t("Editar sala")}
              variant="sidebar"
              size="icon"
              tooltipSide="bottom"
              class="size-9 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/name:opacity-100 hover:text-sidebar-foreground focus-visible:opacity-100 motion-reduce:transition-none"
              onclick={onrenameroom}><Icon icon="pencil-01" /></IconButton
            ></SidebarHeader
          >{#if call}<div class="max-md:hidden">
              {@render call(false)}
            </div>{/if}{@render roomThreads()}
        </div>{/if}{/snippet}
    <!-- The room's threads: the main one, the views, the epics. A DM nests them under its row in the DM list. -->
    {#snippet roomThreads()}<div
        class={dm
          ? "mt-1 ml-4 flex min-h-0 flex-col gap-3 border-l border-sidebar-border pl-2"
          : "contents"}
      >
        {#if dm}{@render roomRow()}{/if}
        <EpicTree
          {room}
          {thread}
          session={navigation}
          mutations={owner}
          {ondonechange}
          onopen={open}
          vb={{
            t: vb.t,
            name: vb.name,
            avatarVersion: vb.avatarVersion,
            epicBusy: vb.epicBusy,
            waitsIn: vb.waitsIn,
          }}
        />
      </div>{/snippet}
    <!-- Phones and DMs: the room's (or the conversation's) own row. On a desktop room the name in the header is the main thread. -->
    <!-- The room's row: its name, ✎ right after it, and on phones your avatar at the end (Gimenes #4108). -->
    {#snippet roomRow()}<div
        class={cn(
          "group/room flex shrink-0 items-center gap-1",
          !dm && "md:hidden",
        )}
      >
        <button
          type="button"
          data-room-title
          aria-current={thread === "main" ? "page" : undefined}
          class={navRow({ class: "w-auto" })}
          onclick={(event) => {
            if (event.currentTarget.isConnected) openMain();
          }}
        >
          {#if dm}<Icon
              icon="message-circle-01"
              size={16}
              class="shrink-0 text-muted-foreground"
            /><span class="min-w-0 truncate">{vb.t("Conversa")}</span
            >{:else}<RoomMark title={room.book.title} src={roomIcon} />
            <span class="min-w-0 truncate">{room.book.title}</span>{/if}
          <WaitBadge
            waits={vb.waitsIn("main")}
            label={(n) => vb.t("{n} coisas esperando você", { n })}
          />
        </button>
        <IconButton
          label={vb.t("Editar sala")}
          size="icon-xs"
          tooltipSide="bottom"
          class="shrink-0 text-muted-foreground hover:text-sidebar-foreground md:hidden"
          onclick={onrenameroom}><Icon icon="pencil-01" /></IconButton
        >{#if phoneAccount}<span
            data-drawer-account
            class="ml-auto flex shrink-0 md:hidden"
            >{@render phoneAccount()}</span
          >{/if}
      </div>{/snippet}
    <!-- On a phone Pinned lives in the Files tab. People & agents is a pane beside the chat (desktop) or the Claude tab (phone). A DM has neither. -->
    {#if !dm}<div class="contents max-md:hidden">
        <PinnedItems
          {room}
          session={pins}
          {send}
          {request}
          onopenfile={onopenpinfile}
          onopenapp={onopenpinapp}
          activeApp={activePinApp}
          t={vb.t}
        />
      </div>{/if}
    <MutationStatus {owner} t={vb.t} />
    <!-- Desktop: your Claude, then you (the account menu), at the foot of the sidebar; you're not in People. -->
    {#snippet selfRows()}<!-- Your own agents (context, ✻), right under your agent. -->
      <div class="px-1.5 empty:hidden">
        <AgentPresenceRows
          {presence}
          self
          email={room.me}
          t={vb.t}
          name={vb.name}
          ago={vb.ago}
          {locale}
        />
      </div>{/snippet}
    <SidebarFoot>
      {#if footer}{@render footer(
          false,
          selfRows,
        )}{:else}{@render selfRows()}{/if}
    </SidebarFoot>
  {/if}
</section>
