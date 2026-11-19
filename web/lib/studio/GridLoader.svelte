<script lang="ts" module>
  const DELAYS = [
    "[animation-delay:0ms]",
    "[animation-delay:100ms]",
    "[animation-delay:200ms]",
    "[animation-delay:100ms]",
    "[animation-delay:200ms]",
    "[animation-delay:200ms]",
    "[animation-delay:300ms]",
    "[animation-delay:300ms]",
    "[animation-delay:400ms]",
  ] as const;
  const CHARTS = [
    "[--cell-color:var(--vb-chart-1)]",
    "[--cell-color:var(--vb-chart-2)]",
    "[--cell-color:var(--vb-chart-3)]",
    "[--cell-color:var(--vb-chart-4)]",
    "[--cell-color:var(--vb-chart-5)]",
  ] as const;
  const MUTED =
    "[--cell-color:color-mix(in_srgb,var(--vb-muted-foreground)_25%,transparent)]";
</script>

<script lang="ts">
  import { cn } from "./utils";

  /** The agent is generating: a 3×3 grid ripples in one chart colour. */
  const chart = CHARTS[Math.ceil(Math.random() * 5) - 1] ?? CHARTS[0];
  const colors = DELAYS.map(() => (Math.random() < 0.6 ? MUTED : chart));
</script>

<div class="grid w-fit grid-cols-[repeat(3,3px)] gap-[1.5px]">
  {#each DELAYS as delay, index (index)}
    <div
      class={cn(
        "size-[3px] rounded-[1px] animate-[grid-ripple_1s_ease_infinite] motion-reduce:[animation-duration:0.01ms] motion-reduce:[animation-iteration-count:1]",
        delay,
        colors[index],
      )}
    ></div>
  {/each}
</div>
