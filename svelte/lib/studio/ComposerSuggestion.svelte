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
    "flex cursor-pointer items-center gap-2.5 rounded-[0.625rem] px-2 py-1.5 text-sm aria-selected:bg-accent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.33] [&_svg:not([class*='text-'])]:text-muted-foreground",
    className,
  )}
>
  {@render icon?.()}
  <span class="min-w-0 flex-1 truncate"
    >{#if typeof title === "string"}{title}{:else}{@render title()}{/if}</span
  >
  {#if meta}
    <span
      class="text-[0.75rem] leading-4 tabular-nums text-muted-foreground shrink-0"
      >{#if typeof meta === "string"}{meta}{:else}{@render meta()}{/if}</span
    >
  {/if}
</div>
