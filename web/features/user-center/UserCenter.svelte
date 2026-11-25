<script lang="ts">
  import type { Snippet } from "svelte";
  /**
   * The user center: the box at the foot of a sidebar (a room's, the home's DM
   * list) with what is about you, not about a room: a new version, your Claude
   * and you (Gimenes #5064). Pushed to the bottom and sticky: when the sidebar
   * is too short and scrolls whole, you stay in view (the sections scroll
   * behind). Desktop only for now; a phone keeps these in its own bars.
   */
  let {
    children,
    above,
  }: {
    children: Snippet;
    /** Over the box, apart from it: the call I am in (CallPanel). */
    above?: Snippet;
  } = $props();
</script>

<div
  class="sticky -bottom-2 z-10 mt-auto -mb-2 shrink-0 bg-sidebar pb-2 max-md:hidden"
>
  {#if above}<div class="pb-2">{@render above()}</div>{/if}
  <div
    data-user-center
    class="flex flex-col gap-0.5 rounded-xl bg-sidebar-accent/50 p-1"
  >
    {@render children()}
  </div>
</div>
