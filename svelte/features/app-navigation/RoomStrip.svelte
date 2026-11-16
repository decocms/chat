<script lang="ts">
  import Button from "../../lib/ui/Button.svelte";
  import IconButton from "../../lib/ui/IconButton.svelte";
  import RoomTile from "../home/RoomTile.svelte";
  import { recentRooms } from "../home/model";
  import { homeText, type HomeLanguage } from "../home/copy";
  import type { AppNavigationSession } from "./controller";
  import UserMenu from "./UserMenu.svelte";
  import { userMenuBridge } from "./menuBridge";
  import { personAvatar } from "../home/model";
  let {
    controller,
    lang,
  }: { controller: AppNavigationSession; lang: HomeLanguage } = $props();
  const personal = $derived(controller.personal.state),
    nav = $derived(controller.state);
  // The shell's account menu (absent in isolated mounts): the rail is hidden
  // in a phone room, so the sheet's strip carries the avatar instead.
  const menu = userMenuBridge();
  // The avatar takes a room tile's place so the home label still fits at
  // phone width (390px: home, 2 rooms, search, avatar).
  const tiles = $derived(menu && $personal.me ? 2 : 3);
</script>

<nav
  data-vb-native="room-strip"
  aria-label={homeText(lang, "home")}
  class="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-border tw:bg-background tw:p-2 tw:font-sans tw:text-sm tw:text-foreground tw:min-[901px]:hidden"
>
  <Button
    variant="ghost"
    size="sm"
    class="tw:min-w-0 tw:shrink!"
    onclick={(event) => {
      if (event.currentTarget.isConnected) controller.callbacks.home();
    }}><span class="tw:truncate">{homeText(lang, "home")}</span></Button
  >{#each recentRooms($personal.me?.books ?? []).slice(0, tiles) as room (room.id)}<RoomTile
      {room}
      {lang}
      compact
      now={$personal.now}
      selected={$nav.roomId === room.id}
      seen={$personal.seen[room.id] ?? 0}
      waits={$personal.me?.waits.filter((wait) => wait.book_id === room.id) ??
        []}
      onnavigate={controller.callbacks.navigate}
      onsettings={(id, trigger) => controller.openSettings(id, trigger)}
    />{/each}<IconButton
    icon="search"
    label={homeText(lang, "search")}
    onclick={(event) => {
      if (event.currentTarget.isConnected)
        controller.openSearch(event.currentTarget);
    }}
  />{#if menu && $personal.me}<UserMenu
      name={$personal.me.name ?? ""}
      email={$personal.me.email}
      avatar={personAvatar($personal.me, $personal.me.email)}
      friends={$personal.me.friends.length}
      lang={menu.lang}
      theme={menu.theme()}
      onsettheme={menu.onsettheme}
      onlanguage={menu.onlanguage}
      onaccount={menu.onaccount}
      pwa={menu.pwa}
      onlogout={menu.onlogout}
    />{/if}
</nav>
