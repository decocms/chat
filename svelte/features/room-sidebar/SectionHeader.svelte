<script lang="ts">
  import type { Snippet } from "svelte";
  /**
   * The title row every titled room sidebar section shares: a 12px muted
   * label and an optional action at its end (a ghost `+`). `id` sits on the
   * title text alone, so a section labelled by it keeps its name. A
   * sub-section inside another section passes `level={4}`.
   */
  let {
    title,
    id,
    level = 3,
    action,
  }: {
    title: string;
    id?: string;
    level?: 3 | 4;
    action?: Snippet;
  } = $props();
</script>

<!-- A section's title stays put while its own list scrolls under it. -->
<div
  class={[
    "flex h-7 items-center justify-between gap-2 pr-0.5 pl-2",
    level === 3 && "sticky top-0 z-10 bg-sidebar",
  ]}
  data-section-header
>
  <svelte:element
    this={`h${level}`}
    class="m-0 min-w-0 truncate font-sans text-xs leading-4 font-medium tracking-normal text-muted-foreground"
    ><span {id}>{title}</span></svelte:element
  >
  {#if action}<div class="flex shrink-0 items-center gap-1">
      {@render action()}
    </div>{/if}
</div>
