<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    ...rest
  }: AlertDialogPrimitive.OverlayProps = $props();
</script>

<AlertDialogPrimitive.Overlay
  bind:ref
  data-slot="alert-dialog-overlay"
  class={cn(
    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:[--tw-exit-opacity:0] data-[state=open]:[--tw-enter-opacity:0] fixed inset-0 z-50 bg-scrim",
    className,
  )}
  {...rest}
/>
