<script lang="ts">
  import { Tabs } from "bits-ui";
  import type { Snippet } from "svelte";
  import { cn } from "./utils";
  export type TabItem = {
    value: string;
    label: string;
    /** A number shown after the label, lighter than it. */
    count?: number | string;
    disabled?: boolean;
  };
  let {
    items,
    label,
    value = $bindable(""),
    onValueChange,
    compact = false,
    children,
    actions,
    class: className,
  }: {
    items: readonly TabItem[];
    label: string;
    value?: string;
    onValueChange?: (value: string) => void;
    /** Shorter, smaller tabs for narrow panels such as the sidebar. */
    compact?: boolean;
    children: Snippet<[string]>;
    /** Controls drawn at the end of the tab row (e.g. a section's +). */
    actions?: Snippet;
    class?: string;
  } = $props();
</script>

{#snippet list()}<Tabs.List
    aria-label={label}
    class={cn(
      "tw:flex tw:shrink-0 tw:gap-1 tw:rounded-control tw:bg-muted",
      compact ? "tw:p-0.5" : "tw:p-1",
      actions && "tw:min-w-0 tw:flex-1",
    )}
  >
    {#each items as item (item.value)}
      <Tabs.Trigger
        type="button"
        value={item.value}
        disabled={item.disabled}
        class={cn(
          "tw:flex-1 tw:cursor-pointer tw:rounded-md tw:border tw:border-transparent tw:bg-transparent tw:font-medium tw:text-muted-foreground tw:outline-none tw:transition-colors tw:hover:text-foreground tw:focus-visible:ring-2 tw:focus-visible:ring-ring tw:disabled:pointer-events-none tw:disabled:opacity-50 tw:data-[state=active]:bg-card tw:data-[state=active]:text-card-foreground tw:data-[state=active]:shadow-xs tw:motion-reduce:transition-none",
          compact
            ? "tw:px-2 tw:py-1 tw:text-[13px] tw:leading-4"
            : "tw:px-3 tw:py-1.5 tw:text-sm tw:leading-5",
        )}
        >{item.label}{#if item.count !== undefined}<b
            class="tw:ml-1 tw:font-semibold tw:opacity-70">{item.count}</b
          >{/if}</Tabs.Trigger
      >
    {/each}
  </Tabs.List>{/snippet}

<Tabs.Root
  bind:value
  {onValueChange}
  class={cn(
    "tw:flex tw:min-h-0 tw:flex-col tw:font-sans tw:text-sm tw:text-foreground",
    compact ? "tw:gap-1.5" : "tw:gap-3",
    className,
  )}
>
  {#if actions}<div class="tw:flex tw:shrink-0 tw:items-center tw:gap-1">
      {@render list()}{@render actions()}
    </div>{:else}{@render list()}{/if}
  {#each items as item (item.value)}
    <Tabs.Content
      value={item.value}
      class={cn(
        "tw:min-h-0 tw:flex-1 tw:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring",
        compact && "tw:flex tw:flex-col",
      )}>{@render children(item.value)}</Tabs.Content
    >
  {/each}
</Tabs.Root>
