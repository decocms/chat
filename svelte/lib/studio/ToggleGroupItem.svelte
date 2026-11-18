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
      "relative z-10 min-w-0 flex-1 shrink-0 rounded-none first:rounded-l-full last:rounded-r-full focus:z-10 focus-visible:z-10 data-[icon-only]:aspect-square data-[icon-only]:px-0",
      "data-[state=on]:[anchor-name:--studio-toggle-active] data-[variant=segmented]:flex-none data-[variant=segmented]:rounded-full supports-[anchor-scope:--a]:in-data-sliding:data-[state=on]:bg-transparent supports-[anchor-scope:--a]:in-data-sliding:data-[state=on]:shadow-none",
      "data-[variant=outline]:border-hairline data-[variant=outline]:shadow-none data-[variant=outline]:not-first:border-l",
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
