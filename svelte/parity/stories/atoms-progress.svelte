<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import Progress from "../../lib/studio/Progress.svelte";

  let { story }: { story: string } = $props();

  const LIMIT = 10;
  let used = $state(6.5);
</script>

{#if story === "default"}
  <Progress value={40} class="w-80" />
{:else if story === "values"}
  <div class="flex w-80 flex-col gap-4">
    <Progress value={0} />
    <Progress value={25} />
    <Progress value={60} />
    <Progress value={100} />
  </div>
{:else if story === "with-label"}
  <div class="flex w-80 flex-col gap-2">
    <div class="flex justify-between text-sm">
      <span class="text-foreground font-medium">Monthly tool calls</span>
      <span class="text-muted-foreground">
        {used.toFixed(1)}k / {LIMIT}k
      </span>
    </div>
    <Progress value={(used / LIMIT) * 100} />
    <Button
      variant="outline"
      size="sm"
      class="w-fit"
      onclick={() => (used = Math.min(used + 0.5, LIMIT))}
    >
      Simulate usage
    </Button>
  </div>
{:else if story === "tones"}
  <div class="flex w-60 flex-col gap-4">
    <Progress value={60} />
    <Progress value={60} tone="warning" />
    <Progress value={60} tone="dark" />
  </div>
{/if}
