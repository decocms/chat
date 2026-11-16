<script lang="ts">
  import type { Snippet } from "svelte";
  import { ToggleGroup as ToggleGroupPrimitive } from "bits-ui";
  import { toggleVariants, type ToggleVariants } from "./toggle";
  import { getToggleGroupContext } from "./toggle-group";
  import Tooltip from "./Tooltip.svelte";
  import TooltipContent from "./TooltipContent.svelte";
  import TooltipTrigger from "./TooltipTrigger.svelte";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `ToggleGroupItem`. `tooltip` is shown on hover and names an icon-only item. */
  let {
    variant,
    size,
    tooltip,
    iconOnly = false,
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<
    ToggleGroupPrimitive.ItemProps,
    "style" | "class" | "child" | "children"
  > &
    ToggleVariants & {
      class?: string;
      tooltip?: string;
      /** React infers this from its children; a snippet cannot be inspected, so say it. */
      iconOnly?: boolean;
      children?: Snippet;
    } = $props();

  const context = $derived(getToggleGroupContext());
  const itemVariant = $derived(context.variant || variant);
  const itemSize = $derived(context.size || size);
  const classes = $derived(
    cn(
      toggleVariants({ variant: itemVariant, size: itemSize }),
      "tw:relative tw:z-10 tw:min-w-0 tw:flex-1 tw:shrink-0 tw:rounded-none tw:first:rounded-l-full tw:last:rounded-r-full tw:focus:z-10 tw:focus-visible:z-10 tw:data-[icon-only]:aspect-square tw:data-[icon-only]:px-0",
      "tw:data-[state=on]:[anchor-name:--studio-toggle-active] tw:data-[variant=segmented]:flex-none tw:data-[variant=segmented]:rounded-full tw:supports-[anchor-scope:--a]:in-data-sliding:data-[state=on]:bg-transparent tw:supports-[anchor-scope:--a]:in-data-sliding:data-[state=on]:shadow-none",
      "tw:data-[variant=outline]:border-hairline tw:data-[variant=outline]:shadow-none tw:data-[variant=outline]:not-first:border-l",
      className,
    ),
  );
</script>

{#snippet item(trigger: Record<string, unknown>)}
  <ToggleGroupPrimitive.Item
    bind:ref
    aria-label={tooltip}
    {...trigger}
    data-slot="toggle-group-item"
    data-variant={itemVariant}
    data-size={itemSize}
    data-icon-only={iconOnly || undefined}
    {...rest}
    class={classes}
  >
    {@render children?.()}
  </ToggleGroupPrimitive.Item>
{/snippet}

{#if tooltip}
  <Tooltip>
    <TooltipTrigger>
      {#snippet child({ props })}
        {@render item(props)}
      {/snippet}
    </TooltipTrigger>
    <TooltipContent>{tooltip}</TooltipContent>
  </Tooltip>
{:else}
  {@render item({})}
{/if}
