<script lang="ts">
  import Spinner from "../../lib/studio/Spinner.svelte";

  let { story }: { story: string } = $props();
</script>

{#if story === "default"}
  <Spinner size="default" />
{:else if story === "colors"}
  <div class="flex items-center gap-4">
    <Spinner />
    <Spinner class="text-secondary" />
    <Spinner class="text-destructive" />
    <Spinner class="text-success" />
    <Spinner class="text-special" />
  </div>
{:else if story === "sizes"}
  <div class="flex items-center gap-4">
    <Spinner size="2xs" />
    <Spinner size="xs" />
    <Spinner size="sm" />
    <Spinner size="default" />
    <Spinner size="lg" />
  </div>
{:else if story === "on-filled-button"}
  <button
    type="button"
    class="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:cursor-not-allowed"
  >
    <Spinner size="xs" />
    Saving
  </button>
{:else if story === "loading-state"}
  <div class="flex items-center gap-3 text-sm text-muted-foreground">
    <Spinner size="xs" />
    Syncing connections...
  </div>
{/if}
