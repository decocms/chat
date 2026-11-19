<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";

  /** The area that opens the menu on right-click; a `span`, as in React. */
  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<ContextMenuPrimitive.TriggerProps, "child"> = $props();
</script>

<ContextMenuPrimitive.Trigger
  bind:ref
  data-slot="context-menu-trigger"
  {...rest}
>
  {#snippet child({ props })}
    <span {...props} class={className}>{@render children?.()}</span>
  {/snippet}
</ContextMenuPrimitive.Trigger>
