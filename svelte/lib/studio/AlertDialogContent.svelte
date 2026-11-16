<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
  import AlertDialogOverlay from "./AlertDialogOverlay.svelte";
  import { cn } from "./utils";

  /** Opening focuses the dialog itself, not Cancel: Bits UI does that by default, as the React component does by hand. */
  let {
    class: className,
    ref = $bindable(null),
    ...rest
  }: AlertDialogPrimitive.ContentProps = $props();
</script>

<AlertDialogPrimitive.Portal>
  <AlertDialogOverlay />
  <AlertDialogPrimitive.Content
    bind:ref
    data-slot="alert-dialog-content"
    class={cn(
      "tw:bg-glass tw:backdrop-blur-[32px] tw:shadow-glass-panel tw:outline-none tw:data-[state=open]:animate-in tw:data-[state=closed]:animate-out tw:data-[state=closed]:[--tw-exit-opacity:0] tw:data-[state=open]:[--tw-enter-opacity:0] tw:data-[state=closed]:[--tw-exit-scale:0.96] tw:data-[state=open]:[--tw-enter-scale:0.96] tw:fixed tw:top-[50%] tw:left-[50%] tw:z-50 tw:grid tw:w-full tw:max-w-[calc(100%-2rem)] tw:translate-x-[-50%] tw:translate-y-[-50%] tw:gap-5 tw:rounded-2xl tw:p-6 tw:duration-300 tw:ease-[cubic-bezier(0.22,1,0.36,1)] tw:sm:max-w-lg",
      className,
    )}
    {...rest}
  />
</AlertDialogPrimitive.Portal>
