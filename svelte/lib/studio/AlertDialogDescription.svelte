<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
  import { cn } from "./utils";

  /** Rendered as `p`, as Radix does; Bits UI would default to a `div`. */
  let {
    class: className,
    children,
    ref = $bindable(null),
    ...rest
  }: Omit<AlertDialogPrimitive.DescriptionProps, "child"> = $props();
</script>

<AlertDialogPrimitive.Description
  bind:ref
  data-slot="alert-dialog-description"
  {...rest}
>
  {#snippet child({ props })}
    <p
      {...props}
      class={cn("text-muted-foreground text-xs text-pretty", className)}
    >
      {@render children?.()}
    </p>
  {/snippet}
</AlertDialogPrimitive.Description>
