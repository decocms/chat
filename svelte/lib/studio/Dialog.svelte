<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";

  /** Ported from @decocms/ui `Dialog`; `defaultOpen` is the initial value of `open`. */
  let { open = $bindable(false), ...rest }: DialogPrimitive.RootProps =
    $props();
</script>

<DialogPrimitive.Root bind:open {...rest} />
