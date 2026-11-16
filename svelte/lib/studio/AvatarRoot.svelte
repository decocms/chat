<script lang="ts">
  import { Avatar as AvatarPrimitive } from "bits-ui";
  import { cn } from "./utils";

  /** Renders a `span` as the React original does; Bits UI's own root is a `div`. */
  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<AvatarPrimitive.RootProps, "style" | "class" | "child"> & {
    class?: string;
  } = $props();
</script>

<AvatarPrimitive.Root bind:ref {...rest}>
  {#snippet child({ props })}
    <span
      {...props}
      data-slot="avatar"
      class={cn(
        "tw:relative tw:flex tw:size-8 tw:shrink-0 tw:overflow-hidden tw:rounded-full",
        className,
      )}>{@render children?.()}</span
    >
  {/snippet}
</AvatarPrimitive.Root>
