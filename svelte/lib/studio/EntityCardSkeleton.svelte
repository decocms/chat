<script lang="ts">
  import Card from "./Card.svelte";
</script>

<!-- Ported from @decocms/ui `EntityCard.Skeleton`. -->
<Card size="tile" aria-hidden="true">
  <div
    class="tw:bg-muted tw:size-8 tw:animate-pulse tw:motion-reduce:[animation-duration:0.01ms] tw:motion-reduce:[animation-iteration-count:1] tw:rounded-lg"
  ></div>
  <div class="tw:flex tw:flex-col tw:gap-1.5">
    <div
      class="tw:bg-muted tw:h-4 tw:w-32 tw:animate-pulse tw:motion-reduce:[animation-duration:0.01ms] tw:motion-reduce:[animation-iteration-count:1] tw:rounded-full"
    ></div>
    <div
      class="tw:bg-muted tw:h-3 tw:w-44 tw:animate-pulse tw:motion-reduce:[animation-duration:0.01ms] tw:motion-reduce:[animation-iteration-count:1] tw:rounded-full"
    ></div>
  </div>
  <div class="tw:border-border tw:flex tw:justify-between tw:border-t tw:pt-3">
    <div
      class="tw:bg-muted tw:h-3 tw:w-16 tw:animate-pulse tw:motion-reduce:[animation-duration:0.01ms] tw:motion-reduce:[animation-iteration-count:1] tw:rounded-full"
    ></div>
  </div>
</Card>
