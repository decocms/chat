<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import { ChevronDown, SearchMd } from "../../lib/studio/icons";
  import { homeText, type HomeLanguage } from "../home/copy";
  import type { AppNavigationSession } from "./controller";
  import RoomSwitcher from "./RoomSwitcher.svelte";
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
  // in a phone room, so the sheet's top row carries the avatar instead.
  const menu = userMenuBridge();
  let switcher = $state(false);
</script>

<nav
  data-vb-native="room-strip"
  aria-label={homeText(lang, "home")}
  class="tw:flex tw:shrink-0 tw:items-center tw:gap-1 tw:pb-1 tw:font-sans tw:text-sm tw:text-sidebar-foreground tw:min-[901px]:hidden"
>
  <Button
    variant="ghost"
    size="sm"
    data-native-room-switcher
    aria-haspopup="dialog"
    aria-expanded={switcher}
    class="tw:min-w-0 tw:shrink! tw:gap-1"
    onclick={(event) => {
      if (event.currentTarget.isConnected) switcher = true;
    }}
    ><span class="tw:truncate">{homeText(lang, "switchRoom")}</span><Icon
      icon={ChevronDown}
      size={14}
    /></Button
  >
  <span class="tw:flex-1"></span>
  <IconButton
    label={homeText(lang, "search")}
    onclick={(event) => {
      if (event.currentTarget.isConnected)
        controller.openSearch(event.currentTarget);
    }}><Icon icon={SearchMd} /></IconButton
  >{#if menu && $personal.me}<UserMenu
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
{#if $personal.me}<RoomSwitcher
    bind:open={switcher}
    rooms={$personal.me.books}
    waits={$personal.me.waits}
    seen={$personal.seen}
    now={$personal.now}
    current={$nav.roomId ?? null}
    {lang}
    onhome={controller.callbacks.home}
    onnavigate={controller.callbacks.navigate}
  />{/if}
