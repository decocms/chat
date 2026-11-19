<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import Icon from "./Icon.svelte";
  import { cn } from "./utils";

  /** The model or tier picker's trigger. Spread a Popover or DropdownMenu trigger's `child` props on it. */
  let {
    icon,
    type = "button",
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLButtonAttributes, "style" | "class" | "children"> & {
    icon?: Snippet;
    class?: string;
    ref?: HTMLButtonElement | null;
    children?: Snippet;
  } = $props();
</script>

<button
  bind:this={ref}
  {type}
  data-slot="composer-model"
  {...rest}
  class={cn(
    "text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 data-[state=open]:bg-accent inline-flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed [&_svg]:size-3.5",
    className,
  )}
>
  {@render icon?.()}
  <span class="truncate">{@render children?.()}</span>
  <Icon icon="chevron-down" class="opacity-60" />
</button>
