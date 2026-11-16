<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    ...rest
  }: SelectPrimitive.GroupHeadingProps = $props();
</script>

<SelectPrimitive.GroupHeading
  bind:ref
  data-slot="select-label"
  class={cn("tw:text-muted-foreground tw:px-2 tw:py-1.5 tw:text-xs", className)}
  {...rest}
/>
