<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";

  /** Ported from @decocms/ui `DropdownMenu`; `defaultOpen` is the initial value of `open`. */
  let { open = $bindable(false), ...rest }: DropdownMenuPrimitive.RootProps =
    $props();
</script>

<DropdownMenuPrimitive.Root bind:open {...rest} />
