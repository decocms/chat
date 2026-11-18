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
          "relative flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-sidebar-foreground outline-offset-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring motion-reduce:transition-none",
          children
            ? "size-9 rounded-xl"
            : "size-8 rounded-full text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}
      >
        {#if current}<RailPill state="selected" />{/if}
        {#if icon}<Icon {icon} class="size-4" />{/if}{@render children?.()}
      </button>
    {/snippet}
  </TooltipTrigger>
  <TooltipContent side="right" sideOffset={8}
    >{hint ? `${label} (${hint})` : label}</TooltipContent
  >
</Tooltip>
