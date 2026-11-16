<script lang="ts">
  import { Toggle as TogglePrimitive } from "bits-ui";
  import { toggleVariants, type ToggleVariants } from "./toggle";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `Toggle`. `bind:pressed` replaces Radix's `defaultPressed`/`pressed` pair. */
  let {
    variant,
    size,
    pressed = $bindable(false),
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<TogglePrimitive.RootProps, "style" | "class"> &
    ToggleVariants & { class?: string } = $props();
</script>

<TogglePrimitive.Root
  bind:ref
  bind:pressed
  data-slot="toggle"
  {...rest}
  class={cn(toggleVariants({ variant, size }), className)}
/>
