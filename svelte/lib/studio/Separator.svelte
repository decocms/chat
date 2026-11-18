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
    "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
    className,
  )}
/>
