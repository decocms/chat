<script lang="ts">
  import EntityGrid, {
    DEFAULT_ENTITY_GRID_COLUMNS,
    type EntityGridColumns,
  } from "./EntityGrid.svelte";

  /** Ported from @decocms/ui `EntityGrid.Skeleton`. */
  let {
    count = 8,
    columns = DEFAULT_ENTITY_GRID_COLUMNS,
    gap = 4,
    class: className,
  }: {
    count?: number;
    columns?: EntityGridColumns;
    gap?: number;
    class?: string;
  } = $props();
</script>

<EntityGrid {columns} {gap} class={className}>
  {#each { length: count }, index (index)}
    <div
      class="tw:bg-card tw:hover:bg-accent tw:transition-colors tw:flex tw:flex-col tw:rounded-lg tw:animate-pulse tw:motion-reduce:[animation-duration:0.01ms] tw:motion-reduce:[animation-iteration-count:1]"
    >
      <div class="tw:p-4 tw:flex tw:flex-col tw:gap-4">
        <div class="tw:h-12 tw:w-12 tw:bg-muted tw:rounded-lg"></div>
        <div class="tw:h-4 tw:w-32 tw:bg-muted tw:rounded-lg"></div>
        <div class="tw:h-4 tw:w-32 tw:bg-muted tw:rounded-lg"></div>
      </div>
      <div class="tw:p-4 tw:border-border tw:border-t tw:flex tw:items-center">
        <div
          class="tw:h-6 tw:w-6 tw:bg-muted tw:rounded-full tw:animate-pulse tw:motion-reduce:[animation-duration:0.01ms] tw:motion-reduce:[animation-iteration-count:1]"
        ></div>
        <div
          class="tw:h-6 tw:w-6 tw:bg-muted tw:rounded-full tw:animate-pulse tw:motion-reduce:[animation-duration:0.01ms] tw:motion-reduce:[animation-iteration-count:1] tw:-ml-2"
        ></div>
        <div
          class="tw:h-6 tw:w-6 tw:bg-muted tw:rounded-full tw:animate-pulse tw:motion-reduce:[animation-duration:0.01ms] tw:motion-reduce:[animation-iteration-count:1] tw:-ml-2"
        ></div>
      </div>
    </div>
  {/each}
</EntityGrid>
