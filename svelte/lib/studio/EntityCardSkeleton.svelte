<script lang="ts">
  import Card from "./Card.svelte";
</script>

<!-- Ported from @decocms/ui `EntityCard.Skeleton`. -->
<Card size="tile" aria-hidden="true">
  <div
    class="bg-muted size-8 animate-pulse motion-reduce:[animation-duration:0.01ms] motion-reduce:[animation-iteration-count:1] rounded-lg"
  ></div>
  <div class="flex flex-col gap-1.5">
    <div
      class="bg-muted h-4 w-32 animate-pulse motion-reduce:[animation-duration:0.01ms] motion-reduce:[animation-iteration-count:1] rounded-full"
    ></div>
    <div
      class="bg-muted h-3 w-44 animate-pulse motion-reduce:[animation-duration:0.01ms] motion-reduce:[animation-iteration-count:1] rounded-full"
    ></div>
  </div>
  <div class="border-border flex justify-between border-t pt-3">
    <div
      class="bg-muted h-3 w-16 animate-pulse motion-reduce:[animation-duration:0.01ms] motion-reduce:[animation-iteration-count:1] rounded-full"
    ></div>
  </div>
</Card>
