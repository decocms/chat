<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLLiAttributes } from "svelte/elements";

  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLLiAttributes, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLLIElement | null;
    children?: Snippet;
  } = $props();
</script>

<li bind:this={ref} data-slot="pagination-item" {...rest} class={className}>
  {@render children?.()}
</li>
