<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import { cn } from "./utils";

  /** `asChild` is the `child` snippet: spread its `props` on your own element. */
  let {
    class: className,
    ref = $bindable(null),
    ...rest
  }: DialogPrimitive.TriggerProps = $props();
</script>

<DialogPrimitive.Trigger
  bind:ref
  data-slot="dialog-trigger"
  class={cn("tw:cursor-pointer tw:disabled:cursor-not-allowed", className)}
  {...rest}
/>
