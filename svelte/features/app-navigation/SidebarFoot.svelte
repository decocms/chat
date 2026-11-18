<script lang="ts">
  import type { Snippet } from "svelte";
  /**
   * The foot of a sidebar on desktop (a room's, the home's DM list): your
   * Claude and you, in one soft box pushed to the bottom. Sticky: when the
   * sidebar is too short and scrolls whole, you stay in view (the sections
   * scroll behind). Phones keep these in their own bars, so it's desktop only.
   */
  let { children }: { children: Snippet } = $props();
</script>

<div
  class="tw:sticky tw:bottom-0 tw:z-10 tw:mt-auto tw:-mb-2 tw:shrink-0 tw:bg-sidebar tw:pb-2 tw:max-md:hidden"
>
  <div
    data-sidebar-self
    class="tw:flex tw:flex-col tw:gap-0.5 tw:rounded-xl tw:bg-sidebar-accent/50 tw:p-1"
  >
    {@render children()}
  </div>
</div>
