<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
  import { buttonVariants } from "./button";
  import { withoutDataState } from "./overlay";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    child: render,
    children,
    ...rest
  }: AlertDialogPrimitive.CancelProps = $props();
</script>

<AlertDialogPrimitive.Cancel
  bind:ref
  class={cn(buttonVariants({ variant: "outline" }), className)}
  {...rest}
>
  {#snippet child({ props })}
    {#if render}
      {@render render({ props: withoutDataState(props) })}
    {:else}
      <button {...withoutDataState(props)}>{@render children?.()}</button>
    {/if}
  {/snippet}
</AlertDialogPrimitive.Cancel>
