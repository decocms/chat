<script lang="ts">
  import type { Snippet } from "svelte";
  /**
   * The user center: the box with what is about you, not about a room: a new
   * version, your notices, your Claude and you (Gimenes #5064). On desktop it
   * is at the foot of a sidebar (a room's, the home's DM list), pushed to the
   * bottom and sticky: when the sidebar is too short and scrolls whole, you
   * stay in view (the sections scroll behind). On a phone (`phone`) the same
   * box is at the top of the Chats list, under the search, with the notices
   * only (HomePanel); inside a room the phone's ← shows their count instead.
   */
  let {
    children,
    above,
    phone = false,
  }: {
    children: Snippet;
    /** Over the box, apart from it: the call I am in (CallPanel). */
    above?: Snippet;
    /** The phone's Chats list: the box alone, in the flow of the list. Draw it only on a phone. */
    phone?: boolean;
  } = $props();
</script>

{#if phone}<div
    data-user-center="phone"
    class="flex flex-col gap-0.5 rounded-xl bg-sidebar-accent/50 p-1"
  >
    {@render children()}
  </div>{:else}<div
    class="sticky -bottom-2 z-10 mt-auto -mb-2 shrink-0 bg-sidebar pb-2 max-md:hidden"
  >
    {#if above}<div class="pb-2">{@render above()}</div>{/if}
    <div
      data-user-center
      class="flex flex-col gap-0.5 rounded-xl bg-sidebar-accent/50 p-1"
    >
      {@render children()}
    </div>
  </div>{/if}
