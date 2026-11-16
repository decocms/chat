<script lang="ts">
  import Spinner from "../../lib/studio/Spinner.svelte";

  let { story }: { story: string } = $props();
</script>

{#if story === "default"}
  <Spinner size="default" />
{:else if story === "colors"}
  <div class="tw:flex tw:items-center tw:gap-4">
    <Spinner />
    <Spinner class="tw:text-secondary" />
    <Spinner class="tw:text-destructive" />
    <Spinner class="tw:text-success" />
    <Spinner class="tw:text-special" />
  </div>
{:else if story === "sizes"}
  <div class="tw:flex tw:items-center tw:gap-4">
    <Spinner size="2xs" />
    <Spinner size="xs" />
    <Spinner size="sm" />
    <Spinner size="default" />
    <Spinner size="lg" />
  </div>
{:else if story === "on-filled-button"}
  <button
    type="button"
    class="tw:inline-flex tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-md tw:bg-primary tw:px-3 tw:py-2 tw:text-sm tw:text-primary-foreground tw:disabled:cursor-not-allowed"
  >
    <Spinner size="xs" />
    Saving
  </button>
{:else if story === "loading-state"}
  <div
    class="tw:flex tw:items-center tw:gap-3 tw:text-sm tw:text-muted-foreground"
  >
    <Spinner size="xs" />
    Syncing connections...
  </div>
{/if}
