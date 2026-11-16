<script lang="ts">
  import TimeRangePicker, {
    type TimeRange,
  } from "../../lib/studio/TimeRangePicker.svelte";
  import { QUICK_RANGES } from "../../lib/studio/time-expressions";

  let { story }: { story: string } = $props();

  let range = $state<TimeRange>({ from: "now-24h", to: "now" });
  const DAYS = QUICK_RANGES.filter((quick) => quick.value.endsWith("d"));
</script>

<!-- React renders each interpolation as its own text node, and glyph positions restart at each one. -->
{#snippet text(content: string)}{content}{/snippet}

<!-- Studio's root line height, which the parity page does not inherit. -->
<div class="tw:leading-[1.5]">
  {#if story === "default" || story === "custom-quick-ranges"}
    <div class="tw:space-y-2">
      <TimeRangePicker
        bind:value={range}
        quickRanges={story === "default" ? undefined : DAYS}
      />
      <p class="tw:text-muted-foreground tw:text-xs tw:text-pretty">
        From {@render text(range.from)}{@render text(" to ")}{@render text(
          range.to,
        )}
      </p>
    </div>
  {:else if story === "disabled"}
    <TimeRangePicker value={{ from: "now-24h", to: "now" }} disabled />
  {/if}
</div>
