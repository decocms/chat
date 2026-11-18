<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import { withoutDataState } from "./overlay";
  import { cn } from "./utils";

  /** `asChild` is the `child` snippet: spread its `props` on your own element. */
  let {
    class: className,
    ref = $bindable(null),
    child: render,
    children,
    ...rest
  }: DialogPrimitive.CloseProps = $props();
</script>

<DialogPrimitive.Close
  bind:ref
  data-slot="sheet-close"
  class={cn("cursor-pointer disabled:cursor-not-allowed", className)}
  {...rest}
>
  {#snippet child({ props })}
    {#if render}
      {@render render({ props: withoutDataState(props) })}
    {:else}
      <button {...withoutDataState(props)}>{@render children?.()}</button>
    {/if}
  {/snippet}
</DialogPrimitive.Close>
