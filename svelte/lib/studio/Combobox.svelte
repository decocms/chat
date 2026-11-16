<script lang="ts">
  import type { Snippet } from "svelte";
  import Button from "./Button.svelte";
  import type { ComboboxOption } from "./combobox";
  import Command from "./Command.svelte";
  import CommandEmpty from "./CommandEmpty.svelte";
  import CommandGroup from "./CommandGroup.svelte";
  import CommandInput from "./CommandInput.svelte";
  import CommandItem from "./CommandItem.svelte";
  import CommandList from "./CommandList.svelte";
  import Icon from "./Icon.svelte";
  import { Check, ChevronSelectorVertical } from "./icons";
  import Popover from "./Popover.svelte";
  import PopoverContent from "./PopoverContent.svelte";
  import PopoverTrigger from "./PopoverTrigger.svelte";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `Combobox`. Controlled: `value` changes only through `onChange`. The render props are snippets, and `width` is a complete class literal. */
  let {
    options,
    value,
    onChange,
    placeholder = "Select...",
    triggerClassName,
    contentClassName,
    width = "tw:w-[200px]",
    renderTrigger,
    renderItem,
    emptyMessage = "No results found.",
    searchPlaceholder = "Search...",
    filter,
    renderSearchAction,
    onSearchChange,
    ariaLabel,
  }: {
    options: ComboboxOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    triggerClassName?: string;
    contentClassName?: string;
    width?: string;
    renderTrigger?: Snippet<[ComboboxOption | undefined]>;
    renderItem?: Snippet<[ComboboxOption, boolean]>;
    emptyMessage?: string;
    searchPlaceholder?: string;
    /** Override how the search matches. Omitted keeps the fuzzy default, which scores subsequences: noisy once there are dozens of similarly-worded options. */
    filter?: (value: string, search: string, keywords?: string[]) => number;
    /** Trailing control on the search row. Receives a close, since whatever it opens replaces this popover. */
    renderSearchAction?: Snippet<[() => void]>;
    /** The search text as typed, for options fetched by query. Reset to "" on close. */
    onSearchChange?: (search: string) => void;
    /** The trigger's accessible name, for a combobox without a visible label. */
    ariaLabel?: string;
  } = $props();

  const selectedOption = $derived(
    options.find((option) => option.value === value),
  );
  let open = $state(false);

  function close() {
    open = false;
    onSearchChange?.("");
  }
</script>

{#snippet searchAction()}
  {@render renderSearchAction?.(close)}
{/snippet}

<Popover
  bind:open
  onOpenChange={(next) => {
    if (!next) onSearchChange?.("");
  }}
>
  <PopoverTrigger>
    {#snippet child({ props })}
      {#if renderTrigger}
        <div {...props} class={cn("tw:cursor-pointer", triggerClassName)}>
          {@render renderTrigger(selectedOption)}
        </div>
      {:else}
        <Button
          {...props}
          variant="outline"
          role="combobox"
          aria-label={ariaLabel}
          class={cn(
            "tw:justify-between tw:rounded-[var(--vb-studio-control-radius,0.625rem)]",
            width,
            triggerClassName,
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
          <Icon icon={ChevronSelectorVertical} class="tw:opacity-50" />
        </Button>
      {/if}
    {/snippet}
  </PopoverTrigger>
  <!-- The width comes last because React set it inline, above any class. -->
  <PopoverContent
    class={cn("tw:p-0", contentClassName, "tw:w-(--bits-popover-anchor-width)")}
  >
    <Command {filter}>
      <CommandInput
        placeholder={searchPlaceholder}
        class="tw:h-9"
        onValueChange={onSearchChange}
        action={renderSearchAction ? searchAction : undefined}
      />
      <CommandList>
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        <CommandGroup>
          {#each options as option (option.value)}
            {@const isSelected = value === option.value}
            <CommandItem
              value={option.label}
              onSelect={() => {
                onChange(option.value === value ? "" : option.value);
                close();
              }}
            >
              {#if renderItem}
                {@render renderItem(option, isSelected)}
              {:else}
                {option.label}
                <Icon
                  icon={Check}
                  class={cn(
                    "tw:ml-auto",
                    isSelected ? "tw:opacity-100" : "tw:opacity-0",
                  )}
                />
              {/if}
            </CommandItem>
          {/each}
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
