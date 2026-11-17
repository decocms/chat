<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import TitledDialog from "../../lib/components/TitledDialog.svelte";
  import { studioType } from "../../lib/components/type";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import { Plus, SearchMd, X } from "../../lib/studio/icons";
  import { cn } from "../../lib/studio/utils";
  import RailButton from "./RailButton.svelte";
  import RailRoom from "./RailRoom.svelte";
  import UserMenu from "./UserMenu.svelte";
  import {
    orderedRooms,
    personAvatar,
    roomRailTint,
    type RoomSummary,
  } from "../home/model";
  import { homeText, type HomeLanguage } from "../home/copy";
  import { createNavigationPresentation } from "./presentation";
  import DeferredViewStatus from "../deferred-view/DeferredViewStatus.svelte";
  import { get } from "svelte/store";
  import { untrack } from "svelte";
  import type { AppNavigationSession } from "./controller";
  import type { UserMenuActions } from "./menuBridge";
  let {
    controller,
    lang,
    theme = "auto",
    ontheme,
    onsettheme,
    onlanguage,
    onreload = () => location.reload(),
    inRoom = false,
    onaccount,
    pwa,
    onlogout,
    loadDialogs = () =>
      import("./AppNavigationDialogs.svelte").then((module) => module.default),
  }: UserMenuActions & {
    controller: AppNavigationSession;
    lang: HomeLanguage;
    theme?: "auto" | "light" | "dark";
    ontheme: () => void;
    /** Sets a specific theme; without it the menu falls back to cycling with `ontheme`. */
    onsettheme?: (theme: "auto" | "light" | "dark") => void;
    onlanguage: (lang: HomeLanguage) => void;
    onreload?: () => void;
    inRoom?: boolean;
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
  const shortcut =
    typeof navigator !== "undefined" &&
    /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)
      ? "⌘K"
      : "Ctrl+K";
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
  const groups = $derived.by(() => {
    const result: { tint: string | undefined; rooms: RoomSummary[] }[] = [];
    for (const room of orderedRooms($personal.me?.books ?? [])) {
      const tint = roomRailTint(room),
        last = result.at(-1);
      if (last && tint && last.tint === tint) last.rooms.push(room);
      else result.push({ tint, rooms: [room] });
    }
    return result;
  });
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
      waits={$personal.me?.waits.filter((wait) => wait.book_id === room.id) ??
        []}
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
    "tw:col-start-1 tw:row-start-1 tw:min-h-0 tw:min-w-0 tw:w-full tw:items-center tw:gap-2 tw:bg-sidebar tw:px-3 tw:py-2 tw:text-sm tw:text-sidebar-foreground tw:min-[901px]:sticky tw:min-[901px]:top-0 tw:min-[901px]:z-40 tw:min-[901px]:flex tw:min-[901px]:h-dvh tw:min-[901px]:flex-col tw:min-[901px]:px-2 tw:min-[901px]:py-3",
    inRoom ? "tw:hidden" : "tw:flex tw:flex-row",
  )}
>
  <RailButton
    bind:ref={homeButton}
    label={text("home")}
    current={!$nav.roomId}
    onclick={(event) => {
      if (event.currentTarget.isConnected) controller.callbacks.home();
    }}
    ><img
      src="/favicon.svg"
      width="36"
      height="36"
      alt=""
      draggable="false"
      class="tw:size-9 tw:rounded-xl"
    /></RailButton
  >
  <span
    aria-hidden="true"
    class="tw:h-6 tw:w-px tw:shrink-0 tw:bg-sidebar-border tw:min-[901px]:h-px tw:min-[901px]:w-6"
  ></span>
  <div
    class="tw:flex tw:min-h-0 tw:min-w-0 tw:flex-1 tw:flex-row tw:items-center tw:gap-2.5 tw:self-stretch tw:overflow-x-auto tw:px-1 tw:py-1.5 tw:[scrollbar-width:none] tw:[&::-webkit-scrollbar]:hidden tw:min-[901px]:-mx-2 tw:min-[901px]:flex-col tw:min-[901px]:overflow-x-hidden tw:min-[901px]:overflow-y-auto tw:min-[901px]:px-2"
    role="list"
    aria-label={text("home")}
  >
    {#each groups as group (group.rooms[0]?.id)}{#if group.tint}<div
          role="listitem"
          data-tint-group
          class={cn(
            "tw:flex tw:flex-row tw:gap-2.5 tw:rounded-2xl tw:p-1.5 tw:min-[901px]:flex-col",
            group.tint,
          )}
        >
          <div role="list" class="tw:contents">
            {#each group.rooms as room (room.id)}{@render roomTile(room)}{/each}
          </div>
        </div>{:else}{#each group.rooms as room (room.id)}{@render roomTile(
            room,
          )}{/each}{/if}{/each}
  </div>
  <div
    class="tw:flex tw:shrink-0 tw:flex-row tw:items-center tw:gap-1 tw:min-[901px]:flex-col"
  >
    <RailButton
      icon={SearchMd}
      label={text("search")}
      hint={shortcut}
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
  {#if $personal.me}<span
      aria-hidden="true"
      class="tw:h-6 tw:w-px tw:shrink-0 tw:bg-sidebar-border tw:min-[901px]:h-px tw:min-[901px]:w-6"
    ></span>
    <UserMenu
      name={$personal.me.name ?? ""}
      email={$personal.me.email}
      avatar={personAvatar($personal.me, $personal.me.email)}
      friends={$personal.me.friends.length}
      {lang}
      {theme}
      {onaccount}
      {pwa}
      {onlogout}
      onsettheme={(next) => {
        if (onsettheme) onsettheme(next);
        else if (next !== theme) ontheme();
      }}
      {onlanguage}
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
    class="tw:fixed tw:bottom-4 tw:right-4 tw:z-30 tw:flex tw:max-w-[calc(100vw-2rem)] tw:items-start tw:gap-2 tw:rounded-2xl tw:bg-popover tw:p-4 tw:font-sans tw:text-sm tw:text-popover-foreground tw:shadow-lg tw:outline-1 tw:outline-hairline"
  >
    <p class="tw:m-0 tw:break-words">
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
    class="tw:fixed tw:bottom-4 tw:left-1/2 tw:z-30 tw:max-w-[calc(100vw-2rem)] tw:-translate-x-1/2 tw:whitespace-normal tw:shadow-lg"
    onclick={(event) => {
      if (event.currentTarget.isConnected) onreload();
    }}>{text("update")}</Button
  >{/if}
