<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import { cn } from "./utils";

  /** Rendered as `p`, as Radix does; Bits UI would default to a `div`. */
  let {
    class: className,
    children,
    ref = $bindable(null),
    ...rest
  }: Omit<DialogPrimitive.DescriptionProps, "child"> = $props();
</script>

<DialogPrimitive.Description bind:ref data-slot="dialog-description" {...rest}>
  {#snippet child({ props })}
    <p
      {...props}
      class={cn("text-muted-foreground text-xs text-pretty", className)}
    >
      {@render children?.()}
    </p>
  {/snippet}
</DialogPrimitive.Description>
