<script lang="ts">
  import type { Snippet } from "svelte";
  import Button from "./Button.svelte";
  import type { ButtonVariants } from "./button";
  import ButtonGroup from "./ButtonGroup.svelte";
  import DropdownMenu from "./DropdownMenu.svelte";
  import DropdownMenuContent from "./DropdownMenuContent.svelte";
  import DropdownMenuItem from "./DropdownMenuItem.svelte";
  import DropdownMenuTrigger from "./DropdownMenuTrigger.svelte";
  import Icon from "./Icon.svelte";
  import { ChevronDown } from "./icons";
  import Spinner from "./Spinner.svelte";
  import type { SplitButtonMenuItem } from "./split-button";
  import Tooltip from "./Tooltip.svelte";
  import TooltipContent from "./TooltipContent.svelte";
  import TooltipTrigger from "./TooltipTrigger.svelte";
  import { cn } from "./utils";

  /** A primary action with an attached menu half. Without `items`, a plain button. */
  let {
    label,
    onclick,
    variant = "default",
    size = "default",
    disabled = false,
    loading = false,
    pulse = false,
    tooltip,
    icon,
    items,
    menuAriaLabel,
    class: className,
  }: {
    label: string;
    onclick?: () => void;
    variant?: ButtonVariants["variant"];
    size?: ButtonVariants["size"];
    /** Disables the primary half ONLY, so a control whose main action is unavailable can still offer its menu. */
    disabled?: boolean;
    /** Shows a spinner in the primary half and swallows its clicks. */
    loading?: boolean;
    /** Breathing brightness on the whole control; static dimming without motion. */
    pulse?: boolean;
    /** Tooltip on the primary half, shown even while it is disabled. */
    tooltip?: string;
    icon?: Snippet;
    /** With no items the chevron half is not rendered at all. */
    items?: SplitButtonMenuItem[];
    /** Accessible name for the chevron trigger. Required: this package is i18n-free. */
    menuAriaLabel: string;
    class?: string;
  } = $props();

  /** Inset, because panel headers clip an outset ring and it would overlap the other half. */
  const INSET_FOCUS_RING =
    "tw:focus-visible:not-forced-colors:outline-none tw:focus-visible:forced-colors:outline-2 tw:focus-visible:forced-colors:outline-offset-0 tw:focus-visible:ring-0 tw:focus-visible:border-border tw:focus-visible:inset-ring-2 tw:focus-visible:inset-ring-ring/50";

  const hasMenu = $derived((items?.length ?? 0) > 0);
  // The `ring` token contrasts with the page, so a filled button rings in its own text colour instead.
  const focusRing = $derived(
    cn(
      INSET_FOCUS_RING,
      variant === "default" && "tw:focus-visible:inset-ring-current",
      // Studio's `shadow-edge` is a plain box-shadow that the ring replaces; here it is a Tailwind shadow that would sit beside it.
      (variant === "outline" || variant === "agent") &&
        "tw:focus-visible:shadow-none",
    ),
  );
</script>

{#snippet primary()}
  <Button
    type="button"
    {variant}
    {size}
    {disabled}
    aria-busy={loading || undefined}
    onclick={loading ? undefined : onclick}
    class={cn(
      focusRing,
      hasMenu && "tw:rounded-r-none tw:border-r tw:border-current/20",
    )}
  >
    {#if loading}<Spinner size="xs" />{:else}{@render icon?.()}{/if}
    {label}
  </Button>
{/snippet}

{#snippet entry(item: SplitButtonMenuItem, props: Record<string, unknown>)}
  <DropdownMenuItem
    {...props}
    disabled={item.disabled}
    onSelect={() => item.onSelect()}
  >
    {@render item.icon?.()}
    {item.label}
  </DropdownMenuItem>
{/snippet}

<ButtonGroup
  class={cn(
    pulse &&
      "tw:animate-pulse-brightness tw:motion-reduce:animate-none tw:motion-reduce:opacity-80",
    className,
  )}
>
  {#if tooltip}
    <Tooltip>
      <!-- When the primary is disabled, the wrapper takes focus so the tooltip stays reachable by keyboard. -->
      <TooltipTrigger>
        {#snippet child({ props })}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <span
            {...props}
            class={cn(
              "tw:inline-flex tw:rounded-lg tw:outline-none",
              focusRing,
              disabled && "tw:cursor-not-allowed",
            )}
            tabindex={disabled ? 0 : undefined}
            role={disabled ? "button" : undefined}
            aria-disabled={disabled || undefined}
          >
            {@render primary()}
          </span>
        {/snippet}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  {:else}
    {@render primary()}
  {/if}

  {#if hasMenu}
    <DropdownMenu>
      <DropdownMenuTrigger>
        {#snippet child({ props })}
          <Button
            {...props}
            type="button"
            {variant}
            {size}
            aria-label={menuAriaLabel}
            class={cn("tw:has-[>svg]:px-2", focusRing)}
          >
            <Icon icon={ChevronDown} class="tw:size-3.5" />
          </Button>
        {/snippet}
      </DropdownMenuTrigger>
      <!-- Radix removes the focused panel's outline itself. -->
      <DropdownMenuContent align="end" class="tw:outline-none">
        {#each items ?? [] as item (item.key)}
          {#if item.tooltip}
            <Tooltip>
              <TooltipTrigger>
                {#snippet child({ props })}
                  {@render entry(item, props)}
                {/snippet}
              </TooltipTrigger>
              <TooltipContent side="right">{item.tooltip}</TooltipContent>
            </Tooltip>
          {:else}
            {@render entry(item, {})}
          {/if}
        {/each}
      </DropdownMenuContent>
    </DropdownMenu>
  {/if}
</ButtonGroup>
