<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import Progress from "../../lib/studio/Progress.svelte";

  let { story }: { story: string } = $props();

  const LIMIT = 10;
  let used = $state(6.5);
</script>

{#if story === "default"}
  <Progress value={40} class="tw:w-80" />
{:else if story === "values"}
  <div class="tw:flex tw:w-80 tw:flex-col tw:gap-4">
    <Progress value={0} />
    <Progress value={25} />
    <Progress value={60} />
    <Progress value={100} />
  </div>
{:else if story === "with-label"}
  <div class="tw:flex tw:w-80 tw:flex-col tw:gap-2">
    <div class="tw:flex tw:justify-between tw:text-sm">
      <span class="tw:text-foreground tw:font-medium">Monthly tool calls</span>
      <span class="tw:text-muted-foreground">
        {used.toFixed(1)}k / {LIMIT}k
      </span>
    </div>
    <Progress value={(used / LIMIT) * 100} />
    <Button
      variant="outline"
      size="sm"
      class="tw:w-fit"
      onclick={() => (used = Math.min(used + 0.5, LIMIT))}
    >
      Simulate usage
    </Button>
  </div>
{:else if story === "tones"}
  <div class="tw:flex tw:w-60 tw:flex-col tw:gap-4">
    <Progress value={60} />
    <Progress value={60} tone="warning" />
    <Progress value={60} tone="dark" />
  </div>
{/if}
