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
  class="sticky -bottom-2 z-10 mt-auto -mb-2 shrink-0 bg-sidebar pb-4 max-md:hidden"
>
  <div
    data-sidebar-self
    class="flex flex-col gap-0.5 rounded-xl bg-sidebar-accent/50 p-1"
  >
    {@render children()}
  </div>
</div>
