<script lang="ts" module>
  const DELAYS = [
    "tw:[animation-delay:0ms]",
    "tw:[animation-delay:100ms]",
    "tw:[animation-delay:200ms]",
    "tw:[animation-delay:100ms]",
    "tw:[animation-delay:200ms]",
    "tw:[animation-delay:200ms]",
    "tw:[animation-delay:300ms]",
    "tw:[animation-delay:300ms]",
    "tw:[animation-delay:400ms]",
  ] as const;
  const CHARTS = [
    "tw:[--cell-color:var(--vb-chart-1)]",
    "tw:[--cell-color:var(--vb-chart-2)]",
    "tw:[--cell-color:var(--vb-chart-3)]",
    "tw:[--cell-color:var(--vb-chart-4)]",
    "tw:[--cell-color:var(--vb-chart-5)]",
  ] as const;
  const MUTED =
    "tw:[--cell-color:color-mix(in_srgb,var(--vb-muted-foreground)_25%,transparent)]";
</script>

<script lang="ts">
  import { cn } from "./utils";

  /** The agent is generating: a 3×3 grid ripples in one chart colour. */
  const chart = CHARTS[Math.ceil(Math.random() * 5) - 1] ?? CHARTS[0];
  const colors = DELAYS.map(() => (Math.random() < 0.6 ? MUTED : chart));
</script>

<div class="tw:grid tw:w-fit tw:grid-cols-[repeat(3,3px)] tw:gap-[1.5px]">
  {#each DELAYS as delay, index (index)}
    <div
      class={cn(
        "tw:size-[3px] tw:rounded-[1px] tw:animate-[grid-ripple_1s_ease_infinite] tw:motion-reduce:[animation-duration:0.01ms] tw:motion-reduce:[animation-iteration-count:1]",
        delay,
        colors[index],
      )}
    ></div>
  {/each}
</div>
