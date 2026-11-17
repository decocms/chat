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
    "tw:flex tw:h-7 tw:items-center tw:justify-between tw:gap-2 tw:pr-0.5 tw:pl-2",
    level === 3 && "tw:sticky tw:top-0 tw:z-10 tw:bg-sidebar",
  ]}
  data-section-header
>
  <svelte:element
    this={`h${level}`}
    class="tw:m-0 tw:min-w-0 tw:truncate tw:font-sans tw:text-xs tw:leading-4 tw:font-medium tw:tracking-normal tw:text-muted-foreground"
    ><span {id}>{title}</span></svelte:element
  >
  {#if action}<div class="tw:flex tw:shrink-0 tw:items-center tw:gap-1">
      {@render action()}
    </div>{/if}
</div>
