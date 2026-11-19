<script lang="ts">
  import { Popover as PopoverPrimitive } from "bits-ui";

  /** Ported from @decocms/ui `Popover`; `defaultOpen` is the initial value of `open`. */
  let { open = $bindable(false), ...rest }: PopoverPrimitive.RootProps =
    $props();
</script>

<PopoverPrimitive.Root bind:open {...rest} />
