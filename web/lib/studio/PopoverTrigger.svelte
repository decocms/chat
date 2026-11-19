<script lang="ts">
  import { Popover as PopoverPrimitive } from "bits-ui";
  import { cn } from "./utils";

  /** `asChild` is the `child` snippet: spread its `props` on your own element. */
  let {
    class: className,
    ref = $bindable(null),
    ...rest
  }: PopoverPrimitive.TriggerProps = $props();
</script>

<PopoverPrimitive.Trigger
  bind:ref
  data-slot="popover-trigger"
  class={cn("cursor-pointer disabled:cursor-not-allowed", className)}
  {...rest}
/>
