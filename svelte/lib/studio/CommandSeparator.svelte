<script lang="ts">
  import { Command as CommandPrimitive } from "bits-ui";
  import { cn } from "./utils";

  /** Hidden while searching, as in cmdk; `alwaysRender` keeps it. */
  let {
    class: className,
    alwaysRender = false,
    ref = $bindable(null),
    ...rest
  }: Omit<CommandPrimitive.SeparatorProps, "forceMount"> & {
    alwaysRender?: boolean;
  } = $props();
</script>

<CommandPrimitive.Separator
  bind:ref
  data-slot="command-separator"
  forceMount={alwaysRender}
  class={cn("bg-border -mx-1 h-px", className)}
  {...rest}
/>
