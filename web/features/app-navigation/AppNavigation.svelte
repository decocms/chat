<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { corporateDomain, isDmId } from "../../../shared/dm";
  import Count from "../../lib/components/Count.svelte";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import SortableItem from "../../lib/components/SortableItem.svelte";
  import SortableList, {
    type SortMove,
  } from "../../lib/components/SortableList.svelte";
  import TitledDialog from "../../lib/components/TitledDialog.svelte";
  import { studioType } from "../../lib/components/type";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import { cn } from "../../lib/studio/utils";
  import RailButton from "./RailButton.svelte";
  import RailRoom from "./RailRoom.svelte";
  import RailDm from "./RailDm.svelte";
  import RoomMenu from "./RoomMenu.svelte";
  import RoomSwitcher from "./RoomSwitcher.svelte";
  import RailCube from "../home/RailCube.svelte";
  import AccountRow from "./AccountRow.svelte";
  import CompanyRooms from "./CompanyRooms.svelte";
  import {
    switcherDms,
    unreadDms,
    dmIds,
    orderedRooms,
    roomsOnly,
    waitsByRoom,
    roomRailTint,
    type RoomSummary,
  } from "../home/model";
  import { homeText, type HomeLanguage } from "../home/copy";
  import { createNavigationPresentation } from "./presentation";
  import DeferredViewStatus from "../deferred-view/DeferredViewStatus.svelte";
  import { get } from "svelte/store";
  import { untrack } from "svelte";
  import type { AppNavigationSession } from "./controller";
  import { searchShortcut } from "./shortcut";
  let {
    controller,
    lang,
    onreload = () => location.reload(),
    inRoom = false,
    accountInSidebar = false,
    onback,
    loadDialogs = () =>
      import("./AppNavigationDialogs.svelte").then((module) => module.default),
  }: {
    controller: AppNavigationSession;
    lang: HomeLanguage;
    onreload?: () => void;
    inRoom?: boolean;
    /** Desktop: you sit at the foot of the page's own sidebar (the home's DM list), so the rail leaves you out. */
    accountInSidebar?: boolean;
    /** Phones: the bar is only this back (Settings, Gimenes #4068). */
    onback?: () => void;
    /** Public-code transport seam; owners and canonical records are never supplied by the loader. */
    loadDialogs?: () => Promise<
      typeof import("./AppNavigationDialogs.svelte").default
    >;
  } = $props();
  const personal = $derived(controller.personal.state),
    draft = $derived(controller.personal.draft),
    nav = $derived(controller.state),
    mutations = $derived(controller.rooms.state),
    search = $derived(controller.search.state),
    company = $derived(controller.company);
  const text = (
    key: Parameters<typeof homeText>[1],
    vars?: Record<string, string | number>,
  ) => homeText(lang, key, vars);
  const menuRoom = $derived(
    $personal.me?.books.find((room) => room.id === $nav.menu?.id),
  );
  const archiveRoom = $derived(
    $personal.me?.books.find((room) => room.id === $nav.archiveId),
  );
  const leaveRoom = $derived(
    $personal.me?.books.find((room) => room.id === $nav.leaveId),
  );
  const renameRoom = $derived(
    $personal.me?.books.find((room) => room.id === $nav.renameId),
  );
  let homeButton = $state<HTMLButtonElement | null>(null);
  const presentation = untrack(() =>
    createNavigationPresentation(controller, loadDialogs),
  );
  const presentationView = presentation.state,
    moduleView = presentation.module.state;
  const Dialogs = $derived($moduleView.component);
  $effect(() => {
    if ($nav.menu && !menuRoom) controller.closeMenu();
    if ($nav.archiveId && !archiveRoom) controller.closeSettings();
    if ($nav.leaveId && !leaveRoom) controller.closeSettings();
    if ($nav.renameId && !renameRoom) controller.closeSettings();
    if (
      renameRoom &&
      $nav.renameSubmitted &&
      !$mutations.pending[`rename:${renameRoom.id}`] &&
      !$mutations.issues[`rename:${renameRoom.id}`] &&
      renameRoom.title === $nav.renameDraft.trim()
    )
      controller.closeSettings();
  });
  onDestroy(() => {
    presentation.dispose();
    controller.pageLeft();
  });
  onMount(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        $personal.me
      ) {
        event.preventDefault();
        if ($search.open) controller.search.close();
        else {
          controller.creator.close();
          controller.closeSettings();
          controller.openSearch(
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : undefined,
          );
        }
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => {
      controller.pageLeft();
      document.removeEventListener("keydown", shortcut);
    };
  });
  const focusBack = () => controller.returnFocus(homeButton);
  // Neighbours of one colour stand as a group on a tinted backdrop; everything else stands alone.
  const waitsIn = $derived(waitsByRoom($personal.me?.waits ?? []));
  // A room moved on the rail shows at its new place at once; the saved order
  // takes over when it arrives (or after the save gives up, 10 s). While a
  // room is dragged, the others make room (dragOrder).
  let localOrder = $state<string[] | null>(null),
    dragOrder = $state<string[] | null>(null),
    localTimer: ReturnType<typeof setTimeout> | undefined;
  const serverRooms = $derived(
    orderedRooms(roomsOnly($personal.me?.books ?? [])),
  );
  const railRooms = $derived.by(() => {
    const order = dragOrder ?? localOrder;
    if (!order) return serverRooms;
    const position = new Map(order.map((id, index) => [id, index]));
    return [...serverRooms].sort(
      (a, b) => (position.get(a.id) ?? 1e9) - (position.get(b.id) ?? 1e9),
    );
  });
  $effect(() => {
    if (
      localOrder &&
      serverRooms.map((room) => room.id).join("\0") === localOrder.join("\0")
    )
      localOrder = null;
  });
  // One flat list, so a room can move between colour runs: each tile carries
  // its run's tint, with the run's corners on its first and last tile.
  const tiles = $derived(
    railRooms.map((room, index) => {
      const tint = roomRailTint(room),
        before = index > 0 ? roomRailTint(railRooms[index - 1]!) : undefined,
        after = roomRailTint(railRooms[index + 1] ?? room);
      const joinsBefore = !!tint && before === tint,
        joinsAfter = !!tint && index < railRooms.length - 1 && after === tint;
      return { room, tint, joinsBefore, joinsAfter, first: index === 0 };
    }),
  );
  const railIds = $derived(railRooms.map((room) => room.id));
  // Press and move a room (a mouse moves 6 px; a finger holds 250 ms): it follows the pointer and the
  // others make room (SortableList, Gimenes #3997 #4020). The whole new order is saved, so a second
  // drop before the first is confirmed builds on it.
  function moved(move: SortMove) {
    localOrder = move.order;
    clearTimeout(localTimer);
    localTimer = setTimeout(() => (localOrder = null), 10_000);
    controller.order(move.order);
  }
  onDestroy(() => clearTimeout(localTimer));
  // A DM belongs to your home: there the home logo is the current one.
  const atHome = $derived(
    !$nav.roomId || dmIds($personal.me).has($nav.roomId) || isDmId($nav.roomId),
  );
  const talkedDms = $derived(switcherDms($personal.me));
  // Desktop: DMs with something new sit under Home, a picture with a count each (like Discord).
  const freshDms = $derived(
    unreadDms($personal.me, $personal.seen, $nav.roomId ?? null),
  );
  // Desktop: your Inbox for all rooms sits under the logo while something waits on you (Gimenes #3837).
  const waiting = $derived($personal.me?.waits.length ?? 0);
  // The home cube turns while an agent works in any of your rooms: the rooms' busy_until, the same
  // signal as each room tile's turning ✻ (personal's clock ticks `now` when the earliest one ends).
  const working = $derived(
    ($personal.me?.books ?? []).some(
      (room) => (room.busy_until ?? 0) > $personal.now,
    ),
  );
  // Phones: the bar is avatar · "Home ▾" · search · +; the ▾ opens every room.
  let switcher = $state(false);
</script>

<div
  data-view="room-navigation"
  data-app-navigation
  class={cn(
    studioType,
    "col-start-1 row-start-1 min-h-0 min-w-0 w-full items-center gap-2 bg-sidebar px-3 py-2 text-sm text-sidebar-foreground sticky top-0 z-40 md:flex md:h-dvh md:flex-col md:px-2 md:pt-2 md:pb-3",
    inRoom ? "hidden" : "flex flex-row",
    // A phone's list of conversations draws its own bar (HomePanel), like a chat app's.
    "max-md:group-has-[[data-home-layout=chats]]/shell:hidden",
  )}
>
  <!-- Desktop: the logo sits in a band as tall as a room's header, so the divider below it meets the header's line. -->
  <!-- The cube opens the Caixa de entrada (the desktop's Home) and carries what waits on you (Gimenes #3967); it turns while an agent works. -->
  <span
    class="relative max-md:hidden md:flex md:h-[51px] md:shrink-0 md:items-center"
    ><RailButton
      bind:ref={homeButton}
      label={working
        ? `${text("inbox")} · ${text("agentsWorking")}`
        : text("inbox")}
      current={atHome}
      onclick={(event) => {
        if (event.currentTarget.isConnected) controller.callbacks.home();
      }}><RailCube {working} /></RailButton
    >{#if waiting}<Count
        value={waiting}
        label={text("waiting", { n: waiting })}
        class="pointer-events-none absolute top-0.5 -right-1 ring-2 ring-sidebar"
      />{/if}</span
  >
  <span
    aria-hidden="true"
    class="h-6 w-px shrink-0 bg-sidebar-border max-md:hidden md:-mt-2 md:h-px md:w-6"
  ></span>
  <!-- Desktop: DMs with something new, right under Home (like Discord); the room tiles follow. -->
  {#if freshDms.length}<div
      data-rail-dms
      class="flex shrink-0 flex-col items-center gap-2.5 py-1.5 max-md:hidden"
    >
      <div
        role="list"
        aria-label={text("dms")}
        class="flex flex-col items-center gap-2.5"
      >
        {#each freshDms as entry (entry.room.id)}<RailDm
            {entry}
            count={entry.count}
            {lang}
            onnavigate={controller.callbacks.navigate}
            onmenu={controller.openMenu}
          />{/each}
      </div>
      <span aria-hidden="true" class="h-px w-6 bg-sidebar-border"></span>
    </div>{/if}
  {#if onback}<IconButton
      label={text("back")}
      data-phone-back
      size="icon"
      class="size-10 rounded-full md:hidden"
      onclick={(event) => {
        if (event.currentTarget.isConnected) onback();
      }}><Icon icon="arrow-left" size={20} /></IconButton
    >{:else}<Button
      variant="ghost"
      data-room-switcher
      aria-haspopup="dialog"
      aria-expanded={switcher}
      class="min-w-0 flex-1 justify-start gap-1 px-2 text-base font-semibold md:hidden"
      onclick={() => (switcher = true)}
      ><span class="truncate">{text("startTitle")}</span><Icon
        icon="chevron-down"
        class="shrink-0 text-muted-foreground"
      /></Button
    >{/if}
  <div
    class="flex min-h-0 min-w-0 flex-1 flex-row items-center self-stretch overflow-x-auto max-md:hidden px-1 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:-mx-2 md:flex-col md:overflow-x-hidden md:overflow-y-auto md:px-2"
    role="list"
    aria-label={text("home")}
  >
    <SortableList ids={railIds} bind:order={dragOrder} onmove={moved}>
      {#each tiles as tile, index (tile.room.id)}<SortableItem
          sortId={tile.room.id}
          {index}
          role="listitem"
          data-tint-run={tile.tint ? "" : undefined}
          class={cn(
            "shrink-0",
            !tile.first && !tile.joinsBefore && "mt-2.5",
            tile.tint && [tile.tint, "px-1.5"],
            tile.tint && !tile.joinsBefore && "rounded-t-2xl pt-1.5",
            tile.tint && !tile.joinsAfter && "rounded-b-2xl pb-1.5",
            tile.joinsAfter && "pb-2.5",
          )}
        >
          <RailRoom
            room={tile.room}
            {lang}
            now={$personal.now}
            selected={$nav.roomId === tile.room.id}
            seen={$personal.seen[tile.room.id] ?? 0}
            waits={waitsIn.get(tile.room.id) ?? []}
            onnavigate={controller.callbacks.navigate}
            onmenu={controller.openMenu}
          />
        </SortableItem>{/each}
    </SortableList>
  </div>
  <div
    class={cn(
      "flex shrink-0 flex-row items-center gap-1 md:flex-col",
      onback && "max-md:hidden",
    )}
  >
    <!-- Rooms open to your company that you did not join (2×2 grid): they stay out of the list, join one from here. -->
    {#if $personal.me && corporateDomain($personal.me.email)}<CompanyRooms
        rooms={$company}
        {lang}
        onjoin={controller.joinCompany}
        onopen={controller.openCompany}
        onclose={controller.closeCompany}
      />{/if}
    <RailButton
      icon="search-md"
      label={text("search")}
      hint={searchShortcut}
      onclick={(event) => {
        if (event.currentTarget.isConnected)
          controller.openSearch(event.currentTarget);
      }}
    />
    <RailButton
      icon="plus"
      label={text("new")}
      onclick={(event) => {
        if (event.currentTarget.isConnected)
          controller.openCreate(event.currentTarget);
      }}
    />
  </div>
  {#if $personal.me}<!-- In a room, and on the home's desktop, your account row (a link to Settings) sits in the user center. -->{#if !inRoom}{#if !accountInSidebar}<span
          aria-hidden="true"
          class="h-6 w-px shrink-0 bg-sidebar-border max-md:hidden md:h-px md:w-6"
        ></span>{/if}
      <div
        class={cn(
          "flex shrink-0", // phones: after search and +, at the right
          accountInSidebar && "md:hidden",
          onback && "max-md:hidden",
        )}
      >
        <AccountRow me={$personal.me} row={false} />
      </div>{/if}
    <RoomSwitcher
      bind:open={switcher}
      rooms={roomsOnly($personal.me.books)}
      dms={talkedDms}
      waits={$personal.me.waits}
      seen={$personal.seen}
      now={$personal.now}
      current={$nav.roomId ?? null}
      {lang}
      onhome={controller.callbacks.home}
      onnavigate={controller.callbacks.navigate}
    />{/if}
</div>
<RoomMenu {controller} {lang} />
{#if Dialogs}<Dialogs
    {controller}
    {lang}
    {presentation}
    fallback={() => homeButton}
  />{:else if $presentationView}{#key $presentationView}<Snapshot
      value={$presentationView}
      >{#snippet children(intent)}<TitledDialog
          open={presentation.owns(intent)}
          title={text(intent.kind === "create" ? "new" : intent.kind)}
          closeLabel={text("close")}
          onOpenChange={(open) => {
            if (!open && get(moduleView).phase !== "ready")
              presentation.close(intent);
          }}
          returnFocus={() =>
            get(moduleView).phase === "ready"
              ? null
              : presentation.returnFocus(intent, homeButton)}
          ><DeferredViewStatus
            phase={$moduleView.phase}
            {lang}
            label={text(intent.kind === "create" ? "new" : intent.kind)}
            current={() => presentation.owns(intent)}
            retry={() => {
              if (presentation.owns(intent)) void presentation.module.retry();
            }}
          /><Button
            variant="outline"
            onclick={(event) => {
              if (
                event.currentTarget.isConnected &&
                get(moduleView).phase !== "ready"
              )
                presentation.close(intent);
            }}>{text("cancel")}</Button
          ></TitledDialog
        >{/snippet}</Snapshot
    >{/key}{/if}

{#if $draft.unknown && $draft.unknown.roomId === $nav.roomId}<aside
    data-view="home-notice"
    role="status"
    class="fixed bottom-4 right-4 z-30 flex max-w-[calc(100vw-2rem)] items-start gap-2 rounded-2xl bg-popover p-4 font-sans text-sm text-popover-foreground shadow-lg outline-1 outline-hairline"
  >
    <p class="m-0 break-words">
      {text("unknown", { who: $draft.unknown.names.join(", ") })}
    </p>
    <IconButton
      label={text("dismiss")}
      onclick={(event) => {
        if (event.currentTarget.isConnected) controller.personal.clearNotice();
      }}><Icon icon="x" /></IconButton
    >
  </aside>{/if}

<!-- A new version waits in the user center (UpdateRow), over your account, not over the chat box. -->
