<script lang="ts">
  import type { Snippet } from "svelte";
  import Badge from "../studio/Badge.svelte";

  /** The one header of a side-panel tab: its name, how many (for lists), one action on the right.
   * While the tab is empty the action lives in its `PaneEmpty`, so callers leave `action` out then. */
  let {
    title,
    count,
    description,
    action,
  }: {
    title: string;
    count?: number;
    description?: string;
    action?: Snippet;
  } = $props();
</script>

<div data-pane-header class="tw:flex tw:min-h-8 tw:items-start tw:gap-2">
  <div class="tw:min-w-0 tw:flex-1">
    <div class="tw:flex tw:items-center tw:gap-2">
      <h2
        class="tw:m-0 tw:font-sans tw:text-base tw:leading-8 tw:font-semibold tw:tracking-normal"
      >
        {title}
      </h2>
      {#if count}<Badge class="tw:tabular-nums">{count}</Badge>{/if}
    </div>
    {#if description}<p
        class="tw:m-0 tw:max-w-prose tw:text-sm tw:leading-5 tw:text-muted-foreground"
      >
        {description}
      </p>{/if}
  </div>
  {#if action}<div class="tw:flex tw:shrink-0 tw:items-center tw:gap-2">
      {@render action()}
    </div>{/if}
</div>
