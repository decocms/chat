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
      "bg-glass backdrop-blur-[32px] shadow-glass-panel outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:[--tw-exit-opacity:0] data-[state=open]:[--tw-enter-opacity:0] data-[state=closed]:[--tw-exit-scale:0.96] data-[state=open]:[--tw-enter-scale:0.96] fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-5 rounded-2xl p-6 duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:max-w-lg",
      className,
    )}
    {...rest}
  />
</AlertDialogPrimitive.Portal>
