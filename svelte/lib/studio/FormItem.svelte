<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { setFormItemContext } from "./form";
  import { cn } from "./utils";

  /** One field's label, control, description and message; its id ties them together. */
  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLAttributes<HTMLDivElement>, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLDivElement | null;
    children?: Snippet;
  } = $props();

  const id = $props.id();
  setFormItemContext(() => ({ id }));
</script>

<div
  bind:this={ref}
  data-slot="form-item"
  {...rest}
  class={cn("tw:grid tw:gap-2", className)}
>
  {@render children?.()}
</div>
