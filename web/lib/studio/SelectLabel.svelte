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
  class={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
  {...rest}
/>
