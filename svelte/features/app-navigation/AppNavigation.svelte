<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { isDmId } from "../../../shared/dm";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import TitledDialog from "../../lib/components/TitledDialog.svelte";
  import { studioType } from "../../lib/components/type";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import { ChevronDown, Plus, SearchMd, X } from "../../lib/studio/icons";
  import { cn } from "../../lib/studio/utils";
  import RailButton from "./RailButton.svelte";
  import RailRoom from "./RailRoom.svelte";
  import RailDm from "./RailDm.svelte";
  import RoomSwitcher from "./RoomSwitcher.svelte";
  import AccountRow from "./AccountRow.svelte";
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
    loadDialogs = () =>
      import("./AppNavigationDialogs.svelte").then((module) => module.default),
  }: {
    controller: AppNavigationSession;
    lang: HomeLanguage;
    onreload?: () => void;
    inRoom?: boolean;
    /** Desktop: you sit at the foot of the page's own sidebar (the home's DM list), so the rail leaves you out. */
    accountInSidebar?: boolean;
    /** Public-code transport seam; owners and canonical records are never supplied by the loader. */
    loadDialogs?: () => Promise<
      typeof import("./AppNavigationDialogs.svelte").default
    >;
  } = $props();
  const personal = $derived(controller.personal.state),
    draft = $derived(controller.personal.draft),
    nav = $derived(controller.state),
    mutations = $derived(controller.rooms.state),
    search = $derived(controller.search.state);
  const text = (
    key: Parameters<typeof homeText>[1],
    vars?: Record<string, string | number>,
  ) => homeText(lang, key, vars);
  const selectedRoom = $derived(
    $personal.me?.books.find((room) => room.id === $nav.settingsId),
  );
  const archiveRoom = $derived(
    $personal.me?.books.find((room) => room.id === $nav.archiveId),
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
    if ($nav.settingsId && !selectedRoom) controller.closeSettings();
    if ($nav.archiveId && !archiveRoom) controller.closeSettings();
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
  const groups = $derived.by(() => {
    const result: { tint: string | undefined; rooms: RoomSummary[] }[] = [];
    for (const room of orderedRooms(roomsOnly($personal.me?.books ?? []))) {
      const tint = roomRailTint(room),
        last = result.at(-1);
      if (last && tint && last.tint === tint) last.rooms.push(room);
      else result.push({ tint, rooms: [room] });
    }
    return result;
  });
  // A DM belongs to your home: there the home logo is the current one.
  const atHome = $derived(
    !$nav.roomId || dmIds($personal.me).has($nav.roomId) || isDmId($nav.roomId),
  );
  const talkedDms = $derived(switcherDms($personal.me));
  // Desktop: DMs with something new sit under Home, a picture with a count each (like Discord).
  const freshDms = $derived(
    unreadDms($personal.me, $personal.seen, $nav.roomId ?? null),
  );
  // Phones: the bar is avatar · "Home ▾" · search · +; the ▾ opens every room.
  let switcher = $state(false);
  let dragging = $state<string | null>(null),
    dropTo = $state<string | null>(null);
</script>

{#snippet roomTile(room: RoomSummary)}<div role="listitem">
    <RailRoom
      {room}
      {lang}
      now={$personal.now}
      selected={$nav.roomId === room.id}
      seen={$personal.seen[room.id] ?? 0}
      waits={waitsIn.get(room.id) ?? []}
      dropping={dropTo === room.id}
      dragging={dragging === room.id}
      onnavigate={controller.callbacks.navigate}
      onsettings={(id, trigger) => controller.openSettings(id, trigger)}
      ondragstart={(event) => {
        event.dataTransfer?.setData("text/plain", room.id);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        dragging = room.id;
      }}
      ondragend={() => {
        dragging = null;
        dropTo = null;
      }}
      ondragover={(event) => {
        event.preventDefault();
        if (dragging && dragging !== room.id) dropTo = room.id;
      }}
      ondragleave={() => {
        if (dropTo === room.id) dropTo = null;
      }}
      ondrop={(event) => {
        event.preventDefault();
        dropTo = null;
        dragging = null;
        const from = event.dataTransfer?.getData("text/plain");
        if (!from) return;
        const target = event.currentTarget;
        if (!(target instanceof HTMLElement)) return;
        const rect = target.getBoundingClientRect();
        controller.drop(
          from,
          room.id,
          event.clientY > rect.top + rect.height / 2,
        );
      }}
    />
  </div>{/snippet}
<div
  data-vb-native="room-navigation"
  data-native-app-navigation
  class={cn(
    studioType,
    "col-start-1 row-start-1 min-h-0 min-w-0 w-full items-center gap-2 bg-sidebar px-3 py-2 text-sm text-sidebar-foreground sticky top-0 z-40 md:flex md:h-dvh md:flex-col md:px-2 md:pt-2 md:pb-3",
    inRoom ? "hidden" : "flex flex-row",
  )}
>
  <!-- Desktop: the logo sits in a band as tall as a room's header, so the divider below it meets the header's line. -->
  <span class="max-md:hidden md:flex md:h-[51px] md:shrink-0 md:items-center"
    ><RailButton
      bind:ref={homeButton}
      label={text("home")}
      current={atHome}
      onclick={(event) => {
        if (event.currentTarget.isConnected) controller.callbacks.home();
      }}
      ><img
        src="/favicon.svg"
        width="36"
        height="36"
        alt=""
        draggable="false"
        class="size-9 rounded-xl"
      /></RailButton
    ></span
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
          />{/each}
      </div>
      <span aria-hidden="true" class="h-px w-6 bg-sidebar-border"></span>
    </div>{/if}
  <Button
    variant="ghost"
    data-native-room-switcher
    aria-haspopup="dialog"
    aria-expanded={switcher}
    class="min-w-0 flex-1 justify-start gap-1 px-2 text-base font-semibold md:hidden"
    onclick={() => (switcher = true)}
    ><span class="truncate">{text("startTitle")}</span><Icon
      icon={ChevronDown}
      class="shrink-0 text-muted-foreground"
    /></Button
  >
  <div
    class="flex min-h-0 min-w-0 flex-1 flex-row items-center gap-2.5 self-stretch overflow-x-auto max-md:hidden px-1 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:-mx-2 md:flex-col md:overflow-x-hidden md:overflow-y-auto md:px-2"
    role="list"
    aria-label={text("home")}
  >
    {#each groups as group (group.rooms[0]?.id)}{#if group.tint}<div
          role="listitem"
          data-tint-group
          class={cn(
            "flex flex-row gap-2.5 rounded-2xl p-1.5 md:flex-col",
            group.tint,
          )}
        >
          <div role="list" class="contents">
            {#each group.rooms as room (room.id)}{@render roomTile(room)}{/each}
          </div>
        </div>{:else}{#each group.rooms as room (room.id)}{@render roomTile(
            room,
          )}{/each}{/if}{/each}
  </div>
  <div class="flex shrink-0 flex-row items-center gap-1 md:flex-col">
    <RailButton
      icon={SearchMd}
      label={text("search")}
      hint={searchShortcut}
      onclick={(event) => {
        if (event.currentTarget.isConnected)
          controller.openSearch(event.currentTarget);
      }}
    />
    <RailButton
      icon={Plus}
      label={text("new")}
      onclick={(event) => {
        if (event.currentTarget.isConnected)
          controller.openCreate(event.currentTarget);
      }}
    />
  </div>
  {#if $personal.me}<!-- In a room, and on the home's desktop, your account row (a link to Settings) sits at the sidebar's foot. -->{#if !inRoom}{#if !accountInSidebar}<span
          aria-hidden="true"
          class="h-6 w-px shrink-0 bg-sidebar-border max-md:hidden md:h-px md:w-6"
        ></span>{/if}
      <div
        class={cn(
          "flex shrink-0", // phones: after search and +, at the right
          accountInSidebar && "md:hidden",
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
{#if Dialogs}<Dialogs
    {controller}
    {lang}
    {presentation}
    fallback={() => homeButton}
  />{:else if $presentationView}{#key $presentationView}<Snapshot
      value={$presentationView}
      >{#snippet children(intent)}<TitledDialog
          open={presentation.owns(intent)}
          title={text(
            intent.kind === "create"
              ? "new"
              : intent.kind === "settings"
                ? "settings"
                : intent.kind,
          )}
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
            label={text(
              intent.kind === "create"
                ? "new"
                : intent.kind === "settings"
                  ? "settings"
                  : intent.kind,
            )}
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
    data-vb-native="home-notice"
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
      }}><Icon icon={X} /></IconButton
    >
  </aside>{/if}

{#if $personal.updateAvailable}<Button
    data-vb-native="update"
    class="fixed bottom-4 left-1/2 z-30 max-w-[calc(100vw-2rem)] -translate-x-1/2 whitespace-normal shadow-lg"
    onclick={(event) => {
      if (event.currentTarget.isConnected) onreload();
    }}>{text("update")}</Button
  >{/if}
