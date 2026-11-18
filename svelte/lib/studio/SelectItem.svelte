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
    "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-lg py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
    description && "items-start py-2",
    className,
  )}
  {...rest}
>
  {#snippet children({ selected })}
    {#if !hideCheck}
      <span class="absolute right-2 flex size-3.5 items-center justify-center">
        {#if selected}
          <span aria-hidden="true"><Icon icon={Check} class="size-4" /></span>
        {/if}
      </span>
    {/if}
    {#if description}
      <div class="flex min-w-0 flex-col gap-0.5">
        <span>{@render content?.()}</span>
        <span class="text-xs whitespace-normal text-muted-foreground">
          {#if typeof description === "string"}{description}{:else}{@render description()}{/if}
        </span>
      </div>
    {:else}
      <span>{@render content?.()}</span>
    {/if}
  {/snippet}
</SelectPrimitive.Item>
