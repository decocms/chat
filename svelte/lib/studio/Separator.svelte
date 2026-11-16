<script lang="ts">
  import { Separator as SeparatorPrimitive } from "bits-ui";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `Separator`: a hairline between groups, decorative unless told otherwise. */
  let {
    class: className,
    orientation = "horizontal",
    decorative = true,
    ref = $bindable(null),
    ...rest
  }: Omit<SeparatorPrimitive.RootProps, "style" | "class"> & {
    class?: string;
  } = $props();
</script>

<SeparatorPrimitive.Root
  bind:ref
  data-slot="separator-root"
  {decorative}
  {orientation}
  {...rest}
  class={cn(
    "tw:bg-border tw:shrink-0 tw:data-[orientation=horizontal]:h-px tw:data-[orientation=horizontal]:w-full tw:data-[orientation=vertical]:h-full tw:data-[orientation=vertical]:w-px",
    className,
  )}
/>
