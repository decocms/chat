<script lang="ts">
  import { onDestroy, untrack, tick } from "svelte";
  import RoomStrip from "./features/app-navigation/RoomStrip.svelte";
  import DmNav from "./features/app-navigation/DmNav.svelte";
  import SidebarFoot from "./features/app-navigation/SidebarFoot.svelte";
  import SearchField from "./features/app-navigation/SearchField.svelte";
  import { homeText } from "./features/home/copy";
  import { navRow } from "./lib/components/navRow";
  import People from "./People.svelte";
  import EpicTree from "./features/navigation/EpicTree.svelte";
  import PinnedItems from "./features/pins/PinnedItems.svelte";
  import RoomMark from "./features/room-sidebar/RoomMark.svelte";
  import PersonAvatar from "./lib/components/PersonAvatar.svelte";
  import { studioType } from "./lib/components/type";
  import Button from "./lib/studio/Button.svelte";
  import Icon from "./lib/studio/Icon.svelte";
  import IconButton from "./lib/studio/IconButton.svelte";
  import Progress from "./lib/studio/Progress.svelte";
  import {
    ArrowLeft,
    Inbox01,
    LayoutAlt01,
    LayoutLeft,
    MessageCircle01,
    Pencil01,
    Plus,
  } from "./lib/studio/icons";
  import { cn } from "./lib/studio/utils";
  import WaitBadge from "./features/waits/WaitBadge.svelte";
  import Count from "./lib/components/Count.svelte";
  import ThreadHeader from "./features/room-sidebar/ThreadHeader.svelte";
  import AgentPresenceRows from "./features/room-sidebar/AgentPresenceRows.svelte";
  import MutationStatus from "./features/room-sidebar/MutationStatus.svelte";
  import { createRoomMutations } from "./features/room-sidebar/session";
  import { messageCount } from "./features/room-sidebar/model";
  import { dmPeer } from "./features/room-scope/model";
  import type { SidebarProps } from "./sidebar";
  let {
    appNavigation,
    room,
    thread,
    friends = [],
    vb,
    send,
    request,
    onopen,
    onarchchange,
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
    oninbox,
    inboxOpen = false,
    onboard,
    boardOpen = false,
    boardCount,
    inboxCount = 0,
    onthreadintent,
    onroomhome,
    mountSheetHandle,
    hideSheetHandle = false,
    footer,
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
  function expandForCreate(trigger: HTMLElement) {
    if (!active) return;
    const account = room.me,
      id = room.id;
    navigation.state.update((value) => ({
      ...value,
      archived: false,
      creating: true,
    }));
    onarchchange(false);
    ontogglerail();
    void tick().then(() => {
      if (
        active &&
        room.me === account &&
        room.id === id &&
        !collapsed &&
        (document.activeElement === document.body ||
          document.activeElement === trigger)
      )
        root?.querySelector<HTMLInputElement>("#newEpic input")?.focus();
    });
  }
  $effect(() => owner.sync(room, request));
  onDestroy(() => {
    active = false;
    if (!external) owner.dispose();
  });
  function open(id: string) {
    if (active && (onthreadintent?.() ?? true)) onopen(id);
  }
  function sheetHandle(node: HTMLElement) {
    return { destroy: mountSheetHandle?.(node) };
  }
</script>

<section
  bind:this={root}
  data-vb-native
  data-native-room-sidebar
  class={cn(
    studioType,
    "flex h-full min-h-[32rem] flex-col overflow-x-hidden bg-sidebar p-2 text-sm leading-5 text-sidebar-foreground",
    // Expanded, the sections take their full height and the sidebar scrolls whole.
    collapsed
      ? "items-center gap-2 overflow-y-auto overscroll-contain"
      : "gap-6 overflow-y-auto overscroll-contain",
  )}
>
  {#if collapsed}
    <IconButton
      label={vb.t("Abrir menu")}
      tooltipSide="right"
      size="icon"
      aria-expanded="false"
      onclick={ontogglerail}><Icon icon={LayoutLeft} /></IconButton
    >
    <IconButton
      href="/"
      data-nav
      label={vb.t("Suas salas")}
      tooltipSide="right"
      size="icon"><Icon icon={ArrowLeft} /></IconButton
    >
    {#if oninbox}<IconButton
        data-native-inbox-toggle={onboard ? "" : undefined}
        variant={inboxOpen ? "secondary" : "ghost"}
        aria-current={inboxOpen ? "page" : undefined}
        aria-pressed={onboard ? inboxOpen : undefined}
        label={vb.t("Caixa de entrada")}
        tooltipSide="right"
        size="icon"
        onclick={(event) => {
          if (event.currentTarget.isConnected) oninbox?.(event.currentTarget);
        }}><Icon icon={Inbox01} /></IconButton
      >{/if}{#if onboard}<IconButton
        data-native-board-toggle
        variant={boardOpen ? "secondary" : "ghost"}
        aria-pressed={boardOpen}
        label={vb.t("Quadro de tarefas (kanban)")}
        tooltipSide="right"
        size="icon"
        onclick={(event) => {
          if (event.currentTarget.isConnected) onboard?.();
        }}><Icon icon={LayoutAlt01} /></IconButton
      >{/if}
    {#each [{ id: "main", title: room.book.title, tasks: [], owner: undefined }, ...room.epics.filter((epic) => !epic.archived || epic.id === thread)] as epic (epic.id)}
      {@const done = epic.tasks.filter((task) => task.done).length}
      <Button
        variant={!inboxOpen && thread === epic.id ? "secondary" : "ghost"}
        class="relative h-auto flex-col gap-1 rounded-lg p-1"
        aria-current={!inboxOpen && thread === epic.id ? "page" : undefined}
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
          taskLabel={vb.t("Tarefa sua pendente")}
          class="absolute -top-1 -right-1"
        /></Button
      >
    {/each}
    <IconButton
      label={vb.t("Novo épico")}
      tooltipSide="right"
      size="icon"
      onclick={(event) => expandForCreate(event.currentTarget)}
      ><Icon icon={Plus} /></IconButton
    >
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
    {#if appNavigation}<RoomStrip
        controller={appNavigation.controller}
        lang={appNavigation.lang}>{@render thisRoom()}</RoomStrip
      >{:else}{@render thisRoom()}{/if}
    {#snippet thisRoom()}{#if dm && appNavigation}<!-- A DM is only a conversation: its row, no threads, views or epics under it. -->
        <DmNav
          controller={appNavigation.controller}
          lang={appNavigation.lang}
        />{:else}<!-- Its full height, like Pinned and People below: the sidebar scrolls whole (one scroll, never two). -->
        <!-- The search on top (the room's name is in the top bar's breadcrumb, not here too). -->
        <div class="flex shrink-0 flex-col gap-3">
          {#if appNavigation}<SearchField
              controller={appNavigation.controller}
              label={homeText(appNavigation.lang, "search")}
            />{/if}{@render roomThreads()}
        </div>{/if}{/snippet}
    <!-- The room's threads: the main one, the views, the epics. A DM nests them under its row in the DM list. -->
    {#snippet roomThreads()}<div
        class={dm
          ? "mt-1 ml-4 flex min-h-0 flex-col gap-3 border-l border-sidebar-border pl-2"
          : "contents"}
      >
        <div class="group/room relative shrink-0">
          <button
            type="button"
            data-room-title
            aria-current={!inboxOpen && !boardOpen && thread === "main"
              ? "page"
              : undefined}
            class={navRow({
              class:
                "transition-[background-color,padding] duration-150 ease-out group-hover/room:pr-9 group-focus-within/room:pr-9 md:group-hover/room:pr-2 md:group-focus-within/room:pr-2 motion-reduce:transition-none [@media(hover:none)]:pr-9",
            })}
            onclick={(event) => {
              if (!event.currentTarget.isConnected) return;
              // Desktop: the main thread is also the chat view (leaves the full board).
              if (boardOpen) onroomhome?.();
              open("main");
            }}
          >
            <!-- Phones: the room's own row. Desktop: the main thread, under the search. -->
            {#if dm}<Icon
                icon={MessageCircle01}
                size={16}
                class="shrink-0 text-muted-foreground"
              /><span class="min-w-0 flex-1 truncate">{vb.t("Conversa")}</span
              >{:else}<RoomMark
                title={room.book.title}
                src={roomIcon}
                class="md:hidden"
              /><Icon
                icon={MessageCircle01}
                size={16}
                class="hidden shrink-0 text-muted-foreground md:block"
              />
              <span class="min-w-0 flex-1 truncate"
                ><span class="md:hidden">{room.book.title}</span><span
                  class="hidden md:inline">{vb.t("Sala principal")}</span
                ></span
              >{/if}
            <WaitBadge
              waits={vb.waitsIn("main")}
              label={(n) => vb.t("{n} coisas esperando você", { n })}
              taskLabel={vb.t("Tarefa sua pendente")}
            />
            <span
              class="shrink-0 text-xs font-normal tabular-nums text-muted-foreground"
              >{messageCount(room, "main")}</span
            >
          </button>
          <IconButton
            label={vb.t("Renomear")}
            size="icon-xs"
            tooltipSide="bottom"
            class="absolute top-1.5 right-1.5 md:hidden translate-x-1 scale-90 text-muted-foreground opacity-0 transition-[opacity,translate,scale] duration-150 ease-out hover:bg-background/60 hover:text-sidebar-foreground focus-visible:translate-x-0 focus-visible:scale-100 focus-visible:opacity-100 group-hover/room:translate-x-0 group-hover/room:scale-100 group-hover/room:opacity-100 motion-reduce:transition-none [@media(hover:none)]:translate-x-0 [@media(hover:none)]:scale-100 [@media(hover:none)]:opacity-100"
            onclick={onrenameroom}><Icon icon={Pencil01} /></IconButton
          >
        </div>
        {#if onboard}<!-- Desktop: the room's views, like the main thread above (chat): they change the whole middle. -->
          <div data-room-views class="-mt-2.5 flex shrink-0 flex-col gap-0.5">
            {#if oninbox}<button
                type="button"
                data-native-inbox-toggle
                aria-pressed={inboxOpen}
                class={navRow()}
                onclick={(event) => {
                  if (event.currentTarget.isConnected)
                    oninbox?.(event.currentTarget);
                }}
                ><Icon
                  icon={Inbox01}
                  size={16}
                  class="shrink-0 text-muted-foreground"
                /><span class="min-w-0 flex-1 truncate"
                  >{vb.t("Caixa de entrada")}</span
                >{#if inboxCount}<Count
                    value={inboxCount}
                    label={vb.t("Esperando você: {n}", { n: inboxCount })}
                  />{/if}</button
              >{/if}<button
              type="button"
              data-native-board-toggle
              aria-pressed={boardOpen}
              class={navRow()}
              onclick={(event) => {
                if (event.currentTarget.isConnected) onboard?.();
              }}
              ><Icon
                icon={LayoutAlt01}
                size={16}
                class="shrink-0 text-muted-foreground"
              /><span class="min-w-0 flex-1 truncate"
                >{vb.t("Quadro de tarefas")}</span
              >{#if typeof boardCount === "number" && boardCount}<Count
                  value={boardCount}
                  label={vb.t("Esperando você: {n}", { n: boardCount })}
                />{/if}</button
            >
          </div>{/if}
        {#if thread !== "main" && !thread.startsWith("pre:")}<div
            class="shrink-0 md:hidden"
          >
            <ThreadHeader {room} {thread} {owner} {vb} {onopenside} />
          </div>{/if}
        <EpicTree
          {room}
          {thread}
          selectionDisabled={inboxOpen}
          onBeforeOpen={onthreadintent}
          session={navigation}
          mutations={owner}
          {onarchchange}
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
    <!-- On a phone these live in the bottom bar: Pinned in Files, People in Claude. A DM has neither. -->
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
        {#snippet agents(email: string)}<AgentPresenceRows
            {presence}
            self={email === room.me}
            {email}
            t={vb.t}
            name={vb.name}
            ago={vb.ago}
            {locale}
          />{/snippet}
        <People
          {room}
          {friends}
          vb={{
            t: vb.t,
            name: vb.name,
            ago: vb.ago,
            avatarVersion: vb.avatarVersion,
          }}
          {agents}
          hideSelf
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
