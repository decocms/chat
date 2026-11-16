<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";
  import { Check } from "./icons";
  import { cn } from "./utils";

  /** `description` is a secondary line under the option; it stays out of the trigger, which shows `label` (or the item's text). */
  let {
    class: className,
    children: content,
    description,
    hideCheck = false,
    ref = $bindable(null),
    ...rest
  }: Omit<SelectPrimitive.ItemProps, "child" | "children"> & {
    hideCheck?: boolean;
    description?: string | Snippet;
    children?: Snippet;
  } = $props();
</script>

<SelectPrimitive.Item
  bind:ref
  data-slot="select-item"
  class={cn(
    "tw:data-[highlighted]:bg-accent tw:data-[highlighted]:text-accent-foreground tw:[&_svg:not([class*='text-'])]:text-muted-foreground tw:relative tw:flex tw:w-full tw:cursor-default tw:items-center tw:gap-2 tw:rounded-lg tw:py-1.5 tw:pr-8 tw:pl-2 tw:text-sm tw:outline-hidden tw:select-none tw:data-[disabled]:pointer-events-none tw:data-[disabled]:opacity-50 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*='size-'])]:size-4 tw:*:[span]:last:flex tw:*:[span]:last:items-center tw:*:[span]:last:gap-2",
    description && "tw:items-start tw:py-2",
    className,
  )}
  {...rest}
>
  {#snippet children({ selected })}
    {#if !hideCheck}
      <span
        class="tw:absolute tw:right-2 tw:flex tw:size-3.5 tw:items-center tw:justify-center"
      >
        {#if selected}
          <span aria-hidden="true"><Icon icon={Check} class="tw:size-4" /></span
          >
        {/if}
      </span>
    {/if}
    {#if description}
      <div class="tw:flex tw:min-w-0 tw:flex-col tw:gap-0.5">
        <span>{@render content?.()}</span>
        <span class="tw:text-xs tw:whitespace-normal tw:text-muted-foreground">
          {#if typeof description === "string"}{description}{:else}{@render description()}{/if}
        </span>
      </div>
    {:else}
      <span>{@render content?.()}</span>
    {/if}
  {/snippet}
</SelectPrimitive.Item>
