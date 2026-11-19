<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "../studio/utils";
  /**
   * The top row of a sidebar (room, DM or home): on desktop the same 52px as
   * the top bar beside it, with its hairline. The sidebar's `p-2` is pulled
   * back so the hairline runs edge to edge. Phones: only the content.
   */
  let { class: className, children }: { class?: string; children: Snippet } =
    $props();
</script>

<div
  data-sidebar-header
  class={cn(
    "flex shrink-0 items-center gap-2 md:-mx-2 md:-mt-2 md:h-[52px] md:border-b md:border-border md:px-2",
    className,
  )}
>
  {@render children()}
</div>
