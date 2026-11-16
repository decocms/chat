<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes } from "svelte/elements";
  import { buttonVariants, type ButtonVariants } from "./button";
  import { cn } from "./utils";

  let {
    isActive,
    size = "icon",
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Pick<ButtonVariants, "size"> &
    Omit<HTMLAnchorAttributes, "style" | "class" | "children"> & {
      isActive?: boolean;
      class?: string;
      ref?: HTMLAnchorElement | null;
      children?: Snippet;
    } = $props();
</script>

<a
  bind:this={ref}
  aria-current={isActive ? "page" : undefined}
  data-slot="pagination-link"
  data-active={isActive}
  {...rest}
  class={cn(
    buttonVariants({ variant: isActive ? "outline" : "ghost", size }),
    className,
  )}>{@render children?.()}</a
>
