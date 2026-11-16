<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import Icon from "./Icon.svelte";
  import { ChevronDown } from "./icons";
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
    "tw:text-muted-foreground tw:hover:bg-accent tw:hover:text-foreground tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:data-[state=open]:bg-accent tw:inline-flex tw:h-7 tw:min-w-0 tw:cursor-pointer tw:items-center tw:gap-1.5 tw:rounded-full tw:px-2.5 tw:text-xs tw:font-medium tw:transition-colors tw:disabled:cursor-not-allowed tw:[&_svg]:size-3.5",
    className,
  )}
>
  {@render icon?.()}
  <span class="tw:truncate">{@render children?.()}</span>
  <Icon icon={ChevronDown} class="tw:opacity-60" />
</button>
