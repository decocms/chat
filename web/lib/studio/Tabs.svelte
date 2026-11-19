<script lang="ts">
  import { Tabs as TabsPrimitive } from "bits-ui";
  import type { TabsVariant } from "./tabs";
  import { cn } from "./utils";

  /** Radix's `defaultValue` is the initial `value`. */
  let {
    ref = $bindable(null),
    value = $bindable(""),
    variant = "pill",
    class: className,
    ...rest
  }: Omit<TabsPrimitive.RootProps, "style" | "class"> & {
    variant?: TabsVariant;
    class?: string;
  } = $props();
</script>

<TabsPrimitive.Root
  bind:ref
  bind:value
  data-slot="tabs"
  data-variant={variant}
  {...rest}
  class={cn("flex flex-col gap-2", className)}
/>
