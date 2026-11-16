<script lang="ts">
  import type { ComponentProps, Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { mergeProps } from "bits-ui";
  import {
    sidebarMenuButtonVariants,
    useSidebar,
    type SidebarMenuButtonVariants,
  } from "./sidebar";
  import Tooltip from "./Tooltip.svelte";
  import TooltipContent from "./TooltipContent.svelte";
  import TooltipTrigger from "./TooltipTrigger.svelte";
  import { cn } from "./utils";

  /** One destination in the sidebar. `tooltip` names it when the rail is collapsed. `asChild` became the `child` snippet: spread `props` on your own element. */
  let {
    isActive = false,
    variant = "default",
    size = "default",
    tooltip,
    class: className,
    ref = $bindable(null),
    child,
    children,
    ...rest
  }: Omit<HTMLButtonAttributes, "style" | "class" | "children"> &
    SidebarMenuButtonVariants & {
      isActive?: boolean;
      tooltip?: string | ComponentProps<typeof TooltipContent>;
      class?: string;
      ref?: HTMLButtonElement | null;
      child?: Snippet<[{ props: Record<string, unknown> }]>;
      children?: Snippet;
    } = $props();

  const sidebar = useSidebar();
  const own = $derived({
    "data-slot": "sidebar-menu-button",
    "data-sidebar": "menu-button",
    "data-size": size,
    "data-active": isActive,
    ...rest,
    class: cn(sidebarMenuButtonVariants({ variant, size }), className),
  });
  const tooltipProps = $derived(
    typeof tooltip === "string" ? undefined : tooltip,
  );
</script>

{#snippet button(trigger: Record<string, unknown>)}
  {@const props = mergeProps(trigger, own)}
  {#if child}
    {@render child({ props })}
  {:else}
    <button bind:this={ref} {...props}>{@render children?.()}</button>
  {/if}
{/snippet}

{#if tooltip}
  <Tooltip>
    <TooltipTrigger>
      {#snippet child({ props })}
        {@render button(props)}
      {/snippet}
    </TooltipTrigger>
    <TooltipContent
      side="right"
      align="center"
      hidden={sidebar.isMobile}
      {...tooltipProps}
    >
      {#if typeof tooltip === "string"}{tooltip}{:else}{@render tooltip.children?.()}{/if}
    </TooltipContent>
  </Tooltip>
{:else}
  {@render button({})}
{/if}
