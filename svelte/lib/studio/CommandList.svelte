<script lang="ts">
  import { Command as CommandPrimitive } from "bits-ui";
  import { cn } from "./utils";

  /** The viewport is cmdk's `cmdk-list-sizer`: the element the rows are sorted in. */
  let {
    class: className,
    children,
    "aria-label": ariaLabel = "Suggestions",
    ref = $bindable(null),
    ...rest
  }: Omit<CommandPrimitive.ListProps, "child"> = $props();
</script>

<CommandPrimitive.List
  bind:ref
  data-slot="command-list"
  tabindex={-1}
  aria-label={ariaLabel}
  class={cn(
    "tw:max-h-[300px] tw:scroll-py-1 tw:overflow-x-hidden tw:overflow-y-auto tw:[scrollbar-width:thin] tw:[scrollbar-color:transparent_transparent] tw:hover:[scrollbar-color:var(--vb-border)_transparent]",
    className,
  )}
  {...rest}
>
  <CommandPrimitive.Viewport>
    {@render children?.()}
  </CommandPrimitive.Viewport>
</CommandPrimitive.List>
