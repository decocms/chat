<script lang="ts">
  import Skeleton from "../../lib/studio/Skeleton.svelte";

  let { story }: { story: string } = $props();

  const ROWS = [0, 1, 2];
</script>

<!-- Studio's root line height, which the parity page does not inherit. -->
<div class="tw:leading-[1.5]">
  {#if story === "default"}
    <Skeleton class="tw:h-4 tw:w-64" />
  {:else if story === "card-placeholder"}
    <div
      class="tw:flex tw:w-80 tw:flex-col tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:p-4"
    >
      <Skeleton class="tw:h-32 tw:w-full" />
      <Skeleton class="tw:h-4 tw:w-3/4" />
      <Skeleton class="tw:h-4 tw:w-1/2" />
    </div>
  {:else if story === "list-placeholder"}
    <div class="tw:flex tw:w-80 tw:flex-col tw:gap-4">
      {#each ROWS as row (row)}
        <div class="tw:flex tw:items-center tw:gap-3">
          <Skeleton class="tw:size-10 tw:rounded-full" />
          <div class="tw:flex tw:flex-1 tw:flex-col tw:gap-2">
            <Skeleton class="tw:h-4 tw:w-40" />
            <Skeleton class="tw:h-3 tw:w-24" />
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
