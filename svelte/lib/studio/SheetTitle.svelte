<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import { cn } from "./utils";

  /** Rendered as `h2`, as Radix does; Bits UI would default to a `div`. */
  let {
    class: className,
    children,
    ref = $bindable(null),
    ...rest
  }: Omit<DialogPrimitive.TitleProps, "child"> = $props();
</script>

<DialogPrimitive.Title bind:ref data-slot="sheet-title" {...rest}>
  {#snippet child({ props })}
    <h2
      {...props}
      class={cn(
        "text-foreground leading-[1.5] font-semibold text-balance",
        className,
      )}
    >
      {@render children?.()}
    </h2>
  {/snippet}
</DialogPrimitive.Title>
