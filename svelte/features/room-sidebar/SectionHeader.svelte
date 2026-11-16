<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "../../lib/ui/utils";
  /**
   * The title row every titled room sidebar section shares: a small uppercase
   * muted heading, an optional count and an optional action (an IconButton
   * with `tip="bottom"`). Sticky rows bleed over the section's `px-3` so they
   * cover content scrolling under them edge to edge. `id` sits on the title
   * text alone, so a section labelled by it keeps its name when the count
   * changes. A sub-section inside another section passes `level={4}`.
   */
  let {
    title,
    id,
    count,
    level = 3,
    sticky = true,
    action,
  }: {
    title: string;
    id?: string;
    /** Shown after a "·" when above zero. */
    count?: number;
    level?: 3 | 4;
    sticky?: boolean;
    action?: Snippet;
  } = $props();
</script>

<div
  class={cn(
    "tw:flex tw:items-center tw:justify-between tw:gap-2",
    action && "tw:min-h-9",
    sticky &&
      "tw:sticky tw:top-0 tw:z-10 tw:-mx-3 tw:box-content tw:bg-sidebar tw:px-3 tw:pt-3 tw:pb-1",
  )}
  data-section-header
>
  <svelte:element
    this={`h${level}`}
    class="tw:m-0 tw:min-w-0 tw:truncate tw:font-sans tw:text-xs tw:leading-5 tw:font-semibold tw:tracking-wide tw:text-muted-foreground tw:uppercase"
    ><span {id}>{title}</span>{#if count}<span aria-hidden="true"
        >{" · "}<span data-section-count>{count}</span></span
      ><span class="tw:sr-only">{` (${count})`}</span>{/if}</svelte:element
  >
  {#if action}<div class="tw:flex tw:shrink-0 tw:items-center tw:gap-1">
      {@render action()}
    </div>{/if}
</div>
