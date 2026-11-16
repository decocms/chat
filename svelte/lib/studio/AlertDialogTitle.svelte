<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
  import { cn } from "./utils";

  /** Rendered as `h2`, as Radix does; Bits UI would default to a `div`. */
  let {
    class: className,
    children,
    ref = $bindable(null),
    ...rest
  }: Omit<AlertDialogPrimitive.TitleProps, "child"> = $props();
</script>

<AlertDialogPrimitive.Title bind:ref data-slot="alert-dialog-title" {...rest}>
  {#snippet child({ props })}
    <h2
      {...props}
      class={cn(
        "tw:text-[1.375rem] tw:leading-tight tw:font-medium tw:tracking-[-0.02em] tw:text-balance",
        className,
      )}
    >
      {@render children?.()}
    </h2>
  {/snippet}
</AlertDialogPrimitive.Title>
