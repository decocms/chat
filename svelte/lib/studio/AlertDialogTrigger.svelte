<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
  import { cn } from "./utils";

  /** `asChild` is the `child` snippet: spread its `props` on your own element. */
  let {
    class: className,
    ref = $bindable(null),
    ...rest
  }: AlertDialogPrimitive.TriggerProps = $props();
</script>

<AlertDialogPrimitive.Trigger
  bind:ref
  data-slot="alert-dialog-trigger"
  class={cn("cursor-pointer disabled:cursor-not-allowed", className)}
  {...rest}
/>
