<script lang="ts">
  import { onDestroy, untrack, tick } from "svelte";
  import RoomStrip from "./features/app-navigation/RoomStrip.svelte";
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
  import Tooltip from "./lib/studio/Tooltip.svelte";
  import TooltipContent from "./lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "./lib/studio/TooltipTrigger.svelte";
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
    "tw:flex tw:h-full tw:min-h-[32rem] tw:flex-col tw:overflow-x-hidden tw:bg-sidebar tw:p-2 tw:text-sm tw:leading-5 tw:text-sidebar-foreground",
    // Expanded, each section scrolls inside itself (epics, pins, people) down
    // to its minimum; only below those minimums does the sidebar scroll whole.
    collapsed
      ? "tw:items-center tw:gap-2 tw:overflow-y-auto tw:overscroll-contain"
      : "tw:gap-6 tw:overflow-y-auto tw:overscroll-contain",
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
      href="/app?ui=svelte"
      data-nav
      label={vb.t("Seus vibebooks")}
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
        class="tw:relative tw:h-auto tw:flex-col tw:gap-1 tw:rounded-lg tw:p-1"
        aria-current={!inboxOpen && thread === epic.id ? "page" : undefined}
        title={epic.title}
        onclick={(event) => {
          if (event.currentTarget.isConnected) open(epic.id);
        }}
        >{#if epic.id === "main"}<RoomMark
            title={room.book.title}
            src={roomIcon}
            class="tw:size-7"
          />{:else}<PersonAvatar
            name={epic.owner ? vb.name(epic.owner) : epic.title}
            url={epic.owner ? vb.avatarUrl?.(epic.owner) : undefined}
            class="tw:size-7"
          />{/if}{#if epic.tasks.length}<Progress
            value={(done / epic.tasks.length) * 100}
            aria-label={vb.t("Tarefas")}
            class="tw:h-1 tw:w-7"
          />{/if}<WaitBadge
          solid
          waits={vb.waitsIn(epic.id)}
          label={(n) => vb.t("{n} coisas esperando você", { n })}
          taskLabel={vb.t("Tarefa sua pendente")}
          class="tw:absolute tw:-top-1 tw:-right-1"
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
          ? "tw:relative tw:flex tw:rounded-full tw:ring-2 tw:ring-brand"
          : "tw:relative tw:flex tw:rounded-full"}
        ><PersonAvatar
          name={vb.name(email)}
          url={vb.avatarUrl?.(email)}
          class="tw:size-7"
        /></span
      >{/each}
    <MutationStatus {owner} t={vb.t} />
    {#if footer}<div
        class="tw:mt-auto tw:shrink-0 tw:pt-2 tw:max-[900px]:hidden"
      >
        {@render footer(true)}
      </div>{/if}
  {:else}
    {#if !hideSheetHandle}<button
        type="button"
        use:sheetHandle
        aria-label={vb.t("Fechar")}
        class="tw:mx-auto tw:h-5 tw:w-12 tw:shrink-0 tw:cursor-pointer tw:rounded-full tw:border-0 tw:bg-muted tw:min-[901px]:hidden"
        onclick={onopenside}
      ></button>{/if}
    {#if appNavigation}<RoomStrip
        controller={appNavigation.controller}
        lang={appNavigation.lang}>{@render thisRoom()}</RoomStrip
      >{:else}{@render thisRoom()}{/if}
    {#snippet thisRoom()}<!-- Takes what Pinned and People leave, and never less than its own rows (header, main
      thread, inbox, board) plus a few epics: Pinned and People shrink and scroll first, so nothing paints over them. -->
      <div class="tw:flex tw:flex-auto tw:flex-col tw:gap-3">
        <!-- Desktop: the room's own header (not a button), the same 52px as the top bar beside it; ✎ on hover. -->
        <div
          data-room-sidebar-header
          class="tw:group/name tw:relative tw:-mx-2 tw:-mt-2 tw:hidden tw:h-[52px] tw:shrink-0 tw:items-center tw:gap-2 tw:border-b tw:border-border tw:pr-2 tw:pl-4 tw:min-[901px]:flex"
        >
          <!-- The room's icon and name: back to the chat (from the board or the inbox). -->
          <button
            type="button"
            data-room-home
            class="tw:flex tw:min-w-0 tw:flex-1 tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-md tw:border-0 tw:bg-transparent tw:p-0 tw:text-left tw:font-sans tw:text-sidebar-foreground tw:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring"
            title={room.book.summary
              ? `${room.book.title}\n${room.book.summary}`
              : room.book.title}
            onclick={() => onroomhome?.()}
          >
            <RoomMark title={room.book.title} src={roomIcon} />
            <h2
              class="tw:m-0 tw:min-w-0 tw:flex-1 tw:truncate tw:text-sm tw:font-semibold"
            >
              {room.book.title}
            </h2>
          </button>
          <IconButton
            label={vb.t("Renomear")}
            size="icon-xs"
            tooltipSide="bottom"
            class="tw:shrink-0 tw:text-muted-foreground tw:opacity-0 tw:transition-opacity tw:duration-150 tw:hover:text-sidebar-foreground tw:focus-visible:opacity-100 tw:group-hover/name:opacity-100 tw:motion-reduce:transition-none"
            onclick={onrenameroom}><Icon icon={Pencil01} /></IconButton
          >
        </div>
        <div class="tw:group/room tw:relative tw:shrink-0">
          <Tooltip>
            <TooltipTrigger>
              {#snippet child({ props })}
                <button
                  {...props}
                  type="button"
                  data-room-title
                  aria-current={!inboxOpen && !boardOpen && thread === "main"
                    ? "page"
                    : undefined}
                  class="tw:flex tw:h-9 tw:w-full tw:min-w-0 tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-lg tw:border-0 tw:bg-transparent tw:px-2 tw:text-left tw:font-sans tw:text-sm tw:text-sidebar-foreground tw:transition-[background-color,padding] tw:duration-150 tw:ease-out tw:hover:bg-sidebar-accent tw:group-hover/room:pr-9 tw:group-focus-within/room:pr-9 tw:min-[901px]:group-hover/room:pr-2 tw:min-[901px]:group-focus-within/room:pr-2 tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:aria-[current=page]:bg-sidebar-accent tw:aria-[current=page]:font-medium tw:motion-reduce:transition-none tw:[@media(hover:none)]:pr-9"
                  onclick={(event) => {
                    if (!event.currentTarget.isConnected) return;
                    // Desktop: the main thread is also the chat view (leaves the full board).
                    if (boardOpen) onroomhome?.();
                    open("main");
                  }}
                >
                  <!-- Phones: the room's own row. Desktop: the main thread, under the header. -->
                  <RoomMark
                    title={room.book.title}
                    src={roomIcon}
                    class="tw:min-[901px]:hidden"
                  /><Icon
                    icon={MessageCircle01}
                    size={16}
                    class="tw:hidden tw:shrink-0 tw:text-muted-foreground tw:min-[901px]:block"
                  />
                  <span class="tw:min-w-0 tw:flex-1 tw:truncate"
                    ><span class="tw:min-[901px]:hidden">{room.book.title}</span
                    ><span class="tw:hidden tw:min-[901px]:inline"
                      >{vb.t("Sala principal")}</span
                    ></span
                  >
                  <WaitBadge
                    waits={vb.waitsIn("main")}
                    label={(n) => vb.t("{n} coisas esperando você", { n })}
                    taskLabel={vb.t("Tarefa sua pendente")}
                  />
                  <span
                    class="tw:shrink-0 tw:text-xs tw:font-normal tw:tabular-nums tw:text-muted-foreground"
                    >{messageCount(room, "main")}</span
                  >
                </button>
              {/snippet}
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              class="tw:max-w-64 tw:whitespace-pre-line tw:text-left"
              >{room.book.summary
                ? `${room.book.title}\n${room.book.summary}`
                : room.book.title}</TooltipContent
            >
          </Tooltip>
          <IconButton
            label={vb.t("Renomear")}
            size="icon-xs"
            tooltipSide="bottom"
            class="tw:absolute tw:top-1.5 tw:right-1.5 tw:min-[901px]:hidden tw:translate-x-1 tw:scale-90 tw:text-muted-foreground tw:opacity-0 tw:transition-[opacity,translate,scale] tw:duration-150 tw:ease-out tw:hover:bg-background/60 tw:hover:text-sidebar-foreground tw:focus-visible:translate-x-0 tw:focus-visible:scale-100 tw:focus-visible:opacity-100 tw:group-hover/room:translate-x-0 tw:group-hover/room:scale-100 tw:group-hover/room:opacity-100 tw:motion-reduce:transition-none tw:[@media(hover:none)]:translate-x-0 tw:[@media(hover:none)]:scale-100 tw:[@media(hover:none)]:opacity-100"
            onclick={onrenameroom}><Icon icon={Pencil01} /></IconButton
          >
        </div>
        {#if onboard}<!-- Desktop: the room's views, like the main thread above (chat): they change the whole middle. -->
          <div data-room-views class="tw:-mt-3 tw:flex tw:shrink-0 tw:flex-col">
            {#if oninbox}<button
                type="button"
                data-native-inbox-toggle
                aria-pressed={inboxOpen}
                class="tw:flex tw:h-9 tw:w-full tw:min-w-0 tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-lg tw:border-0 tw:bg-transparent tw:px-2 tw:text-left tw:font-sans tw:text-sm tw:text-sidebar-foreground tw:hover:bg-sidebar-accent tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:aria-pressed:bg-sidebar-accent tw:aria-pressed:font-medium"
                onclick={(event) => {
                  if (event.currentTarget.isConnected)
                    oninbox?.(event.currentTarget);
                }}
                ><Icon
                  icon={Inbox01}
                  size={16}
                  class="tw:shrink-0 tw:text-muted-foreground"
                /><span class="tw:min-w-0 tw:flex-1 tw:truncate"
                  >{vb.t("Caixa de entrada")}</span
                >{#if inboxCount}<Count
                    value={inboxCount}
                    label={vb.t("Esperando você: {n}", { n: inboxCount })}
                  />{/if}</button
              >{/if}<button
              type="button"
              data-native-board-toggle
              aria-pressed={boardOpen}
              class="tw:flex tw:h-9 tw:w-full tw:min-w-0 tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-lg tw:border-0 tw:bg-transparent tw:px-2 tw:text-left tw:font-sans tw:text-sm tw:text-sidebar-foreground tw:hover:bg-sidebar-accent tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:aria-pressed:bg-sidebar-accent tw:aria-pressed:font-medium"
              onclick={(event) => {
                if (event.currentTarget.isConnected) onboard?.();
              }}
              ><Icon
                icon={LayoutAlt01}
                size={16}
                class="tw:shrink-0 tw:text-muted-foreground"
              /><span class="tw:min-w-0 tw:flex-1 tw:truncate"
                >{vb.t("Quadro de tarefas")}</span
              >{#if typeof boardCount === "number" && boardCount}<Count
                  value={boardCount}
                  label={vb.t("Esperando você: {n}", { n: boardCount })}
                />{/if}</button
            >
          </div>{/if}
        {#if thread !== "main" && !thread.startsWith("pre:")}<div
            class="tw:shrink-0 tw:min-[901px]:hidden"
          >
            <ThreadHeader
              {room}
              {thread}
              {owner}
              {vb}
              {roomIcon}
              {onopenside}
              {onrenameroom}
            />
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
            epicBusy: vb.epicBusy,
            waitsIn: vb.waitsIn,
          }}
        />
      </div>{/snippet}
    <!-- On a phone these live in the bottom bar: Pinned in Files, People in Claude. -->
    <div class="tw:contents tw:max-[900px]:hidden">
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
        vb={{ t: vb.t, name: vb.name, ago: vb.ago, avatarUrl: vb.avatarUrl }}
        {agents}
        hideSelf
      />
    </div>
    <MutationStatus {owner} t={vb.t} />
    <!-- Desktop: your Claude, then you (the account menu), at the foot of the sidebar; you're not in People. -->
    <div
      data-sidebar-self
      class="tw:mt-auto tw:flex tw:shrink-0 tw:flex-col tw:gap-0.5 tw:rounded-xl tw:bg-sidebar-accent/50 tw:p-1 tw:max-[900px]:hidden"
    >
      {@render footer?.(false)}
      <!-- Your own Claudes (context, ✻), as they were under you in People. -->
      <div class="tw:px-1.5 tw:empty:hidden">
        <AgentPresenceRows
          {presence}
          self
          email={room.me}
          t={vb.t}
          name={vb.name}
          ago={vb.ago}
          {locale}
        />
      </div>
    </div>
  {/if}
</section>
