<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
  import { setContext } from "svelte";
  import { ALERT_DIALOG_CLOSE } from "./overlay";

  /** Ported from @decocms/ui `AlertDialog`; `defaultOpen` is the initial value of `open`. */
  let {
    open = $bindable(false),
    onOpenChange,
    ...rest
  }: AlertDialogPrimitive.RootProps = $props();

  // Bits UI leaves the action button inert; Radix closes the dialog from it.
  setContext(ALERT_DIALOG_CLOSE, () => {
    if (!open) return;
    open = false;
    onOpenChange?.(false);
  });
</script>

<AlertDialogPrimitive.Root bind:open {onOpenChange} {...rest} />
