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

<div data-pane-header class="flex min-h-8 items-start gap-2">
  <div class="min-w-0 flex-1">
    <div class="flex items-center gap-2">
      <h2
        class="m-0 font-sans text-base leading-8 font-semibold tracking-normal"
      >
        {title}
      </h2>
      {#if count}<Badge class="tabular-nums">{count}</Badge>{/if}
    </div>
    {#if description}<p
        class="m-0 max-w-prose text-sm leading-5 text-muted-foreground"
      >
        {description}
      </p>{/if}
  </div>
  {#if action}<div class="flex shrink-0 items-center gap-2">
      {@render action()}
    </div>{/if}
</div>
