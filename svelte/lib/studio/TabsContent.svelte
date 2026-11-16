<script lang="ts">
  import { Tabs as TabsPrimitive } from "bits-ui";
  import { cn } from "./utils";

  let {
    ref = $bindable(null),
    class: className,
    ...rest
  }: Omit<TabsPrimitive.ContentProps, "style" | "class"> & {
    class?: string;
  } = $props();
</script>

<TabsPrimitive.Content
  bind:ref
  data-slot="tabs-content"
  {...rest}
  class={cn("tw:flex-1 tw:outline-none tw:h-full", className)}
/>
