<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import Icon from "../../lib/studio/Icon.svelte";
  import type { IconNode } from "../../lib/studio/icons";
  import Tooltip from "../../lib/studio/Tooltip.svelte";
  import TooltipContent from "../../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../../lib/studio/TooltipTrigger.svelte";
  import { cn } from "../../lib/studio/utils";
  import RailPill from "./RailPill.svelte";
  /**
   * A rail action: a ghost round icon button, or (with `children`) a 36px
   * tile like a room's, such as the home mark. `current` draws the bar a
   * selected room gets.
   */
  let {
    label,
    icon,
    hint,
    current = false,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLButtonAttributes, "style" | "class" | "children"> & {
    label: string;
    icon?: IconNode;
    /** Shown after the label in the tooltip, e.g. a keyboard shortcut. */
    hint?: string;
    current?: boolean;
    ref?: HTMLButtonElement | null;
    children?: Snippet;
  } = $props();
</script>

<Tooltip>
  <TooltipTrigger>
    {#snippet child({ props })}
      <button
        {...props}
        {...rest}
        bind:this={ref}
        type="button"
        aria-label={label}
        aria-current={current ? "page" : undefined}
        class={cn(
          "tw:relative tw:flex tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:border-0 tw:bg-transparent tw:p-0 tw:text-sidebar-foreground tw:outline-offset-2 tw:transition-colors tw:duration-150 tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:motion-reduce:transition-none",
          children
            ? "tw:size-9 tw:rounded-xl"
            : "tw:size-8 tw:rounded-full tw:text-muted-foreground tw:hover:bg-sidebar-accent tw:hover:text-sidebar-foreground",
        )}
      >
        {#if current}<RailPill state="selected" />{/if}
        {#if icon}<Icon {icon} class="tw:size-4" />{/if}{@render children?.()}
      </button>
    {/snippet}
  </TooltipTrigger>
  <TooltipContent side="right" sideOffset={8}
    >{hint ? `${label} (${hint})` : label}</TooltipContent
  >
</Tooltip>
