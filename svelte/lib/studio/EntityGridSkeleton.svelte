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
      class="bg-card hover:bg-accent transition-colors flex flex-col rounded-lg animate-pulse motion-reduce:[animation-duration:0.01ms] motion-reduce:[animation-iteration-count:1]"
    >
      <div class="p-4 flex flex-col gap-4">
        <div class="h-12 w-12 bg-muted rounded-lg"></div>
        <div class="h-4 w-32 bg-muted rounded-lg"></div>
        <div class="h-4 w-32 bg-muted rounded-lg"></div>
      </div>
      <div class="p-4 border-border border-t flex items-center">
        <div
          class="h-6 w-6 bg-muted rounded-full animate-pulse motion-reduce:[animation-duration:0.01ms] motion-reduce:[animation-iteration-count:1]"
        ></div>
        <div
          class="h-6 w-6 bg-muted rounded-full animate-pulse motion-reduce:[animation-duration:0.01ms] motion-reduce:[animation-iteration-count:1] -ml-2"
        ></div>
        <div
          class="h-6 w-6 bg-muted rounded-full animate-pulse motion-reduce:[animation-duration:0.01ms] motion-reduce:[animation-iteration-count:1] -ml-2"
        ></div>
      </div>
    </div>
  {/each}
</EntityGrid>
