<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { corporateDomain, isDmId } from "../../../shared/dm";
  import Count from "../../lib/components/Count.svelte";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import SortableItem from "../../lib/components/SortableItem.svelte";
  import SortableList from "../../lib/components/SortableList.svelte";
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
  import RailFolder from "./RailFolder.svelte";
  import FolderMenu from "./FolderMenu.svelte";
  import FolderSettings from "./FolderSettings.svelte";
  import {
    applyIntent,
    dropIntent,
    folderOf,
    newFolderId,
    previewable,
    railEntries,
    sameShape,
    shapeOf,
    type RailEntry,
    type RailHit,
    type RailIntent,
    type RailShape,
  } from "./railFolders";
  import RoomSwitcher from "./RoomSwitcher.svelte";
  import RailCube from "../home/RailCube.svelte";
  import AccountRow from "./AccountRow.svelte";
  import CompanyRooms from "./CompanyRooms.svelte";
  import {
    switcherDms,
    unreadDms,
    dmIds,
    roomsOnly,
    waitsByRoom,
    roomRailTint,
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
  // Your rail: rooms and your folders (railFolders.ts). A change shows at
  // once; the saved rail takes over when it arrives (or after the save gives
  // up, 10 s). While a tile is dragged, the rail shows where it would go in
  // its own list (dragShape); a drop on a room, into a folder or out of one
  // shows when it lands.
  const books = $derived($personal.me?.books ?? []);
  const folders = $derived($personal.me?.folders ?? []);
  const serverShape = $derived(shapeOf(railEntries(books, folders)));
  let localShape = $state<RailShape | null>(null),
    dragShape = $state<RailShape | null>(null),
    intent = $state<RailIntent | null>(null),
    dragging = $state<string | null>(null),
    localTimer: ReturnType<typeof setTimeout> | undefined,
    railList = $state<HTMLElement | null>(null),
    base: RailShape | null = null;
  const shape = $derived(dragShape ?? localShape ?? serverShape);
  $effect(() => {
    if (localShape && sameShape(serverShape, localShape)) localShape = null;
  });
  const roomById = $derived(new Map(books.map((room) => [room.id, room])));
  const folderById = $derived(
    new Map(folders.map((folder) => [folder.id, folder])),
  );
  const openFolders = $derived(controller.openFolders);
  // What the rail draws, from `shape` (a folder made by a drop a moment ago is drawn before the server knows it).
  const entries = $derived(
    shape.flatMap((item): RailEntry[] => {
      if ("room" in item) {
        const room = roomById.get(item.room);
        return room ? [{ kind: "room", room }] : [];
      }
      const rooms = item.rooms.flatMap((id) => roomById.get(id) ?? []);
      if (!rooms.length) return [];
      const folder = folderById.get(item.folder) ?? {
        id: item.folder,
        name: null,
        tint: null,
        position: null,
      };
      return [{ kind: "folder", folder, rooms }];
    }),
  );
  // Neighbours of one colour stand as a group on a tinted backdrop; a folder breaks the run. Each tile carries its
  // run's tint, with the run's corners on its first and last tile.
  const tiles = $derived(
    entries.map((entry, index) => {
      const tintOf = (other: RailEntry | undefined) =>
        other?.kind === "room" ? roomRailTint(other.room) : undefined;
      const tint = tintOf(entry),
        before = tintOf(entries[index - 1]),
        after = tintOf(entries[index + 1]);
      const joinsBefore = !!tint && before === tint,
        joinsAfter = !!tint && after === tint;
      return {
        entry,
        id: entry.kind === "room" ? entry.room.id : entry.folder.id,
        tint,
        joinsBefore,
        joinsAfter,
        first: index === 0,
      };
    }),
  );
  const railIds = $derived(
    entries.flatMap((entry) =>
      entry.kind === "room"
        ? [entry.room.id]
        : [entry.folder.id, ...entry.rooms.map((room) => room.id)],
    ),
  );
  const folderIds = $derived(
    new Set(shape.flatMap((item) => ("folder" in item ? [item.folder] : []))),
  );
  /** The tiles under the pointer, read from the rail as drawn now (not the dragged one, nor dnd-kit's placeholder). */
  function hits(source: string): RailHit[] {
    if (!railList) return [];
    const list: RailHit[] = [];
    for (const element of railList.querySelectorAll<HTMLElement>(
      "[data-rail-item], [data-rail-member]",
    )) {
      if (element.closest("[data-dnd-placeholder]")) continue;
      const box = element.getBoundingClientRect();
      if (!box.height) continue;
      const member = element.dataset.railMember;
      if (member) {
        const folder = element.dataset.railIn ?? "";
        if (member !== source && folder !== source)
          list.push({
            id: member,
            kind: "room",
            in: folder,
            top: box.top,
            bottom: box.bottom,
          });
        continue;
      }
      const id = element.dataset.railItem ?? "";
      if (id === source) continue;
      const kind = element.dataset.railKind === "folder" ? "folder" : "room";
      const head =
        kind === "folder" && $openFolders.has(id)
          ? element
              .querySelector("[data-rail-folder-head]")
              ?.getBoundingClientRect()
          : undefined;
      list.push({
        id,
        kind,
        in: null,
        top: box.top,
        bottom: box.bottom,
        ...(head ? { head: { top: head.top, bottom: head.bottom } } : {}),
      });
    }
    return list;
  }
  // Press and move a tile (a mouse moves 6 px; a finger holds 250 ms): it follows the pointer (SortableList, Gimenes
  // #3997 #4020). On another room's middle it makes a folder with it; on a folder's, it joins it; at an edge, it goes
  // before or after; out of a folder's block, it leaves the folder (like Discord).
  const drag = {
    move(id: string, _x: number, y: number) {
      base ??= shape;
      dragging = id;
      const source = {
        id,
        kind: folderIds.has(id) ? ("folder" as const) : ("room" as const),
        in: folderOf(base, id),
      };
      const next = dropIntent(source, y, hits(id));
      intent = next;
      if (next && previewable(base, id, next))
        dragShape = applyIntent(base, id, next, id);
    },
    drop(id: string, canceled: boolean) {
      const from = base,
        last = intent;
      base = null;
      intent = null;
      dragging = null;
      dragShape = null;
      if (canceled || !from || !last) return;
      const next = applyIntent(from, id, last, newFolderId());
      if (sameShape(next, from)) return;
      localShape = next;
      clearTimeout(localTimer);
      localTimer = setTimeout(() => (localShape = null), 10_000);
      controller.rail(next);
    },
  };
  // What the drop would do, drawn on the rail: the room or folder it would go into gets an outline.
  const into = $derived(
    !dragging || !intent
      ? null
      : intent.kind === "combine"
        ? intent.target
        : intent.in !== null && intent.in !== folderOf(base ?? shape, dragging)
          ? intent.in
          : null,
  );
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
    bind:this={railList}
  >
    <SortableList ids={railIds} onmove={() => {}} manual={drag}>
      {#each tiles as tile, index (tile.id)}<SortableItem
          sortId={tile.id}
          {index}
          role="listitem"
          data-rail-item={tile.id}
          data-rail-kind={tile.entry.kind}
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
          {#if tile.entry.kind === "room"}<div
              data-rail-target={into === tile.id || undefined}
              class={cn(
                "rounded-xl outline-offset-2",
                into === tile.id &&
                  "outline-2 outline-solid outline-foreground",
              )}
            >
              <RailRoom
                room={tile.entry.room}
                {lang}
                now={$personal.now}
                selected={$nav.roomId === tile.entry.room.id}
                seen={$personal.seen[tile.entry.room.id] ?? 0}
                waits={waitsIn.get(tile.entry.room.id) ?? []}
                onnavigate={controller.callbacks.navigate}
                onmenu={controller.openMenu}
              />
            </div>{:else}{@const folder = tile.entry.folder}{@const open =
              $openFolders.has(folder.id)}<RailFolder
              {folder}
              rooms={tile.entry.rooms}
              {open}
              {lang}
              seen={$personal.seen}
              waits={$personal.me?.waits ?? []}
              selected={tile.entry.rooms.some(
                (room) => room.id === $nav.roomId,
              )}
              target={into === folder.id}
              ontoggle={() => controller.toggleFolder(folder.id)}
              onmenu={(trigger, point) =>
                controller.openFolderMenu(folder.id, trigger, point)}
            >
              {#each tile.entry.rooms as room, at (room.id)}<SortableItem
                  sortId={room.id}
                  index={at}
                  group={folder.id}
                  disabled={!open}
                  role="listitem"
                  data-rail-member={room.id}
                  data-rail-in={folder.id}
                  class="mt-2.5 shrink-0"
                >
                  <RailRoom
                    {room}
                    {lang}
                    now={$personal.now}
                    selected={$nav.roomId === room.id}
                    seen={$personal.seen[room.id] ?? 0}
                    waits={waitsIn.get(room.id) ?? []}
                    onnavigate={controller.callbacks.navigate}
                    onmenu={controller.openMenu}
                  />
                </SortableItem>{/each}
            </RailFolder>{/if}
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
<FolderMenu {controller} {lang} />
<FolderSettings {controller} {lang} />
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
