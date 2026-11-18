<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { SearchMd } from "../../lib/studio/icons";
  import type { AppNavigationSession } from "./controller";
  /**
   * The search box at the top of a sidebar (home, DM or room). It looks like
   * a field but it is a button: it opens the one search dialog (⌘K), which
   * finds rooms, conversations and files everywhere.
   */
  let {
    controller,
    label,
  }: { controller: AppNavigationSession; label: string } = $props();
</script>

<Button
  variant="outline"
  data-sidebar-search
  class="tw:w-full tw:shrink-0 tw:justify-start tw:gap-2 tw:font-normal tw:text-muted-foreground"
  onclick={(event) => {
    if (event.currentTarget.isConnected)
      controller.openSearch(event.currentTarget);
  }}
  ><Icon icon={SearchMd} size={16} /><span class="tw:truncate">{label}</span
  ></Button
>
