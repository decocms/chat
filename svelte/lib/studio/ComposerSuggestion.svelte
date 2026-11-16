<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** One row of the @ and / menu; `active` is the row the keyboard is on. */
  let {
    icon,
    title,
    meta,
    active = false,
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<
    HTMLAttributes<HTMLDivElement>,
    "style" | "class" | "children" | "title"
  > & {
    icon?: Snippet;
    title: string | Snippet;
    meta?: string | Snippet;
    active?: boolean;
    class?: string;
    ref?: HTMLDivElement | null;
  } = $props();
</script>

<div
  bind:this={ref}
  data-slot="composer-suggestion"
  role="option"
  aria-selected={active}
  tabindex={-1}
  {...rest}
  class={cn(
    "tw:flex tw:cursor-pointer tw:items-center tw:gap-2.5 tw:rounded-[0.625rem] tw:px-2 tw:py-1.5 tw:text-sm tw:aria-selected:bg-accent tw:[&_svg]:size-4 tw:[&_svg]:shrink-0 tw:[&_svg]:stroke-[1.33] tw:[&_svg:not([class*='text-'])]:text-muted-foreground",
    className,
  )}
>
  {@render icon?.()}
  <span class="tw:min-w-0 tw:flex-1 tw:truncate"
    >{#if typeof title === "string"}{title}{:else}{@render title()}{/if}</span
  >
  {#if meta}
    <span
      class="tw:text-[0.75rem] tw:leading-4 tw:tabular-nums tw:text-muted-foreground tw:shrink-0"
      >{#if typeof meta === "string"}{meta}{:else}{@render meta()}{/if}</span
    >
  {/if}
</div>
