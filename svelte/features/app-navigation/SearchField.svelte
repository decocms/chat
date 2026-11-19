<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import CommandShortcut from "../../lib/studio/CommandShortcut.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { SearchMd } from "../../lib/studio/icons";
  import type { AppNavigationSession } from "./controller";
  import { searchShortcut } from "./shortcut";
  /**
   * The search box at the top of a sidebar (home, DM or room). It looks like
   * a field but it is a button: it opens the one search dialog (⌘K), which
   * finds rooms, conversations and files everywhere. Desktop: it is the
   * sidebar's header row, the same 52px as the top bar beside it, so the
   * sidebar's `p-2` is pulled back for the row's hairline to run edge to edge.
   */
  let {
    controller,
    label,
  }: { controller: AppNavigationSession; label: string } = $props();
</script>

<div
  data-sidebar-search-row
  class="flex shrink-0 items-center md:-mx-2 md:-mt-2 md:h-[52px] md:border-b md:border-border md:px-2"
>
  <!-- The composer's corners (rounded-2xl), and the shortcut on the right where there is a keyboard. -->
  <Button
    variant="outline"
    data-sidebar-search
    class="w-full justify-start gap-2 rounded-2xl font-normal text-muted-foreground"
    onclick={(event) => {
      if (event.currentTarget.isConnected)
        controller.openSearch(event.currentTarget);
    }}
    ><Icon icon={SearchMd} size={16} /><span class="truncate">{label}</span
    ><CommandShortcut data-search-shortcut class="max-md:hidden"
      >{searchShortcut}</CommandShortcut
    ></Button
  >
</div>
