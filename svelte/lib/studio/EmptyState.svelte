<script lang="ts">
  import type { ComponentProps, Snippet } from "svelte";
  import Button from "./Button.svelte";
  import {
    emptyStateIconVariants,
    emptyStateVariants,
    type EmptyStateVariants,
  } from "./empty-state";
  import { cn } from "./utils";

  /** Nothing here yet, nothing matched, or it failed: say why and offer the next step. */
  let {
    icon,
    illustration,
    title,
    description,
    buttonProps,
    buttonComponent,
    size,
    tone,
    class: className,
    children,
  }: EmptyStateVariants & {
    icon?: Snippet;
    /** Instead of the icon tile, for rare moments: the agent, a first run. */
    illustration?: Snippet;
    title: string;
    description?: string | Snippet;
    buttonProps?: ComponentProps<typeof Button>;
    buttonComponent?: Snippet;
    class?: string;
    children?: Snippet;
  } = $props();
</script>

<div class={cn(emptyStateVariants({ size }), className)}>
  {#if illustration}
    {@render illustration()}
  {:else if icon}
    <div class={emptyStateIconVariants({ tone })}>{@render icon()}</div>
  {/if}
  <div class="tw:flex tw:max-w-xs tw:flex-col tw:items-center tw:gap-1">
    <h3 class="tw:text-foreground tw:text-sm tw:font-medium tw:text-balance">
      {title}
    </h3>
    {#if description}
      <div class="tw:text-muted-foreground tw:text-sm">
        {#if typeof description === "string"}{description}{:else}{@render description()}{/if}
      </div>
    {/if}
  </div>
  {#if buttonComponent}
    {@render buttonComponent()}
  {:else if buttonProps}
    <Button size="sm" {...buttonProps} />
  {/if}
  {@render children?.()}
</div>
