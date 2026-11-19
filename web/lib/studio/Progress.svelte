<script lang="ts">
  import { Progress as ProgressPrimitive } from "bits-ui";
  import {
    progressIndicatorVariants,
    type ProgressIndicatorVariants,
  } from "./progress";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `Progress`. */
  let {
    value,
    tone,
    ref = $bindable(null),
    class: className,
    ...rest
  }: Omit<
    ProgressPrimitive.RootProps,
    "class" | "style" | "children" | "child"
  > &
    ProgressIndicatorVariants & { class?: string } = $props();

  // Clamped so an over-quota bar reads as full and a negative one as empty.
  const pct = $derived(Math.min(100, Math.max(0, value ?? 0)));
</script>

<ProgressPrimitive.Root
  bind:ref
  value={pct}
  data-slot="progress"
  {...rest}
  class={cn(
    "bg-muted relative h-1 w-full overflow-hidden rounded-full",
    className,
  )}
>
  <progress
    data-slot="progress-indicator"
    aria-hidden="true"
    value={pct}
    max="100"
    class={progressIndicatorVariants({ tone })}
  ></progress>
</ProgressPrimitive.Root>
