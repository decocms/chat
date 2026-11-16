<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    ...rest
  }: DialogPrimitive.OverlayProps = $props();
</script>

<DialogPrimitive.Overlay
  bind:ref
  data-slot="dialog-overlay"
  class={cn(
    "tw:data-[state=open]:animate-in tw:data-[state=closed]:animate-out tw:data-[state=closed]:[--tw-exit-opacity:0] tw:data-[state=open]:[--tw-enter-opacity:0] tw:fixed tw:inset-0 tw:z-50 tw:bg-scrim",
    className,
  )}
  {...rest}
/>
