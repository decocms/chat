<script lang="ts">
  import type { MeResult } from "../../../shared/schemas";
  import { personAvatar } from "../home/model";
  import { userMenuBridge } from "./menuBridge";
  import UserMenu from "./UserMenu.svelte";
  /**
   * You and the account menu: a row at a sidebar's foot (a room's, the home's
   * DM list), or just your face (`row={false}`, the phone's top bar). The
   * actions come from the application's user-menu bridge; without one nothing
   * is drawn.
   */
  let { me, row = true }: { me: MeResult; row?: boolean } = $props();
  const menu = userMenuBridge();
</script>

{#if menu}<UserMenu
    {row}
    name={me.name ?? ""}
    email={me.email}
    avatar={personAvatar(me, me.email)}
    lang={menu.lang}
    theme={menu.theme()}
    onsettheme={menu.onsettheme}
    onlanguage={menu.onlanguage}
    onaccount={menu.onaccount}
    pwa={menu.pwa}
    onlogout={menu.onlogout}
  />{/if}
