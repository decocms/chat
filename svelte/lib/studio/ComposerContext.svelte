<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** How full the context window is, as a ring and a percentage. */
  let {
    value,
    type = "button",
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<HTMLButtonAttributes, "style" | "class" | "children" | "value"> & {
    /** From 0 to 1. */
    value: number;
    class?: string;
    ref?: HTMLButtonElement | null;
  } = $props();
  const clamped = $derived(Math.min(1, Math.max(0, value)));
  const tone = $derived(
    clamped >= 0.95
      ? "text-destructive"
      : clamped >= 0.8
        ? "text-warning"
        : "text-muted-foreground",
  );
</script>

<button
  bind:this={ref}
  {type}
  data-slot="composer-context"
  {...rest}
  class={cn(
    "hover:bg-accent focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 tabular-nums inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2 text-xs transition-colors disabled:cursor-not-allowed",
    tone,
    className,
  )}
>
  <svg viewBox="0 0 16 16" aria-hidden="true" class="size-3.5! -rotate-90">
    <circle
      cx="8"
      cy="8"
      r="6.5"
      fill="none"
      stroke="currentColor"
      stroke-opacity="0.2"
      stroke-width="2"
    />
    <circle
      cx="8"
      cy="8"
      r="6.5"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      pathLength="100"
      stroke-dasharray={`${clamped * 100} 100`}
    />
  </svg>
  {Math.round(clamped * 100)}%
</button>
