<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
  import { getContext } from "svelte";
  import { buttonVariants, type ButtonVariants } from "./button";
  import { ALERT_DIALOG_CLOSE, withoutDataState } from "./overlay";
  import { cn } from "./utils";

  let {
    class: className,
    variant,
    onclick,
    ref = $bindable(null),
    child: render,
    children,
    ...rest
  }: AlertDialogPrimitive.ActionProps &
    Pick<ButtonVariants, "variant"> = $props();

  const close = getContext<(() => void) | undefined>(ALERT_DIALOG_CLOSE);
</script>

<AlertDialogPrimitive.Action
  bind:ref
  onclick={(event) => {
    onclick?.(event);
    if (!event.defaultPrevented) close?.();
  }}
  class={cn(buttonVariants({ variant }), className)}
  {...rest}
>
  {#snippet child({ props })}
    {#if render}
      {@render render({ props: withoutDataState(props) })}
    {:else}
      <button {...withoutDataState(props)}>{@render children?.()}</button>
    {/if}
  {/snippet}
</AlertDialogPrimitive.Action>
