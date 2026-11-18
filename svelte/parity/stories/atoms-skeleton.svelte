<script lang="ts">
  import Skeleton from "../../lib/studio/Skeleton.svelte";

  let { story }: { story: string } = $props();

  const ROWS = [0, 1, 2];
</script>

<!-- Studio's root line height, which the parity page does not inherit. -->
<div class="leading-[1.5]">
  {#if story === "default"}
    <Skeleton class="h-4 w-64" />
  {:else if story === "card-placeholder"}
    <div class="flex w-80 flex-col gap-3 rounded-lg border border-border p-4">
      <Skeleton class="h-32 w-full" />
      <Skeleton class="h-4 w-3/4" />
      <Skeleton class="h-4 w-1/2" />
    </div>
  {:else if story === "list-placeholder"}
    <div class="flex w-80 flex-col gap-4">
      {#each ROWS as row (row)}
        <div class="flex items-center gap-3">
          <Skeleton class="size-10 rounded-full" />
          <div class="flex flex-1 flex-col gap-2">
            <Skeleton class="h-4 w-40" />
            <Skeleton class="h-3 w-24" />
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
