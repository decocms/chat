<script lang="ts">
  import Badge from "./Badge.svelte";
  import Checkbox from "./Checkbox.svelte";
  import Command from "./Command.svelte";
  import CommandEmpty from "./CommandEmpty.svelte";
  import CommandGroup from "./CommandGroup.svelte";
  import CommandInput from "./CommandInput.svelte";
  import CommandItem from "./CommandItem.svelte";
  import CommandList from "./CommandList.svelte";
  import Icon from "./Icon.svelte";
  import { ChevronDown } from "./icons";
  import type { Option } from "./multi-select";
  import Popover from "./Popover.svelte";
  import PopoverContent from "./PopoverContent.svelte";
  import PopoverTrigger from "./PopoverTrigger.svelte";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `MultiSelect`. As there, the selection always follows `defaultValue`: update it from `onValueChange`. */
  let {
    options,
    onValueChange,
    defaultValue = [],
    placeholder = "Select items",
    maxCount = 3,
    modalPopover = false,
    class: className,
    disabled = false,
    onSearchChange,
  }: {
    options: Option[];
    onValueChange: (value: string[]) => void;
    defaultValue?: string[];
    placeholder?: string;
    /** Inert, as in React, where it set a duration on badges that carry no animation. */
    animation?: number;
    maxCount?: number;
    modalPopover?: boolean;
    class?: string;
    disabled?: boolean;
    /** When provided, disables client-side filtering and delegates search to the caller. */
    onSearchChange?: (term: string) => void;
  } = $props();

  const selectedValues = $derived(defaultValue);
  const allSelected = $derived(
    selectedValues.length === options.length && options.length > 0,
  );
  let open = $state(false);

  function handleInputKeyDown(
    event: KeyboardEvent & { currentTarget: HTMLInputElement },
  ) {
    if (event.key === "Enter") {
      open = true;
    } else if (event.key === "Backspace" && !event.currentTarget.value) {
      onValueChange(selectedValues.slice(0, -1));
    }
  }

  function toggleOption(option: Option) {
    onValueChange(
      selectedValues.includes(option.value)
        ? selectedValues.filter((value) => value !== option.value)
        : [...selectedValues, option.value],
    );
  }

  function toggleAll() {
    onValueChange(
      selectedValues.length === options.length
        ? []
        : options.map((option) => option.value),
    );
  }

  function stop(event: Event) {
    event.stopPropagation();
  }
</script>

<Popover bind:open>
  <PopoverTrigger>
    {#snippet child({ props })}
      <button
        {...props}
        type="button"
        class={cn(
          "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 aria-invalid:bg-destructive/10 aria-invalid:shadow-[inset_0_0_0_1px_var(--vb-destructive)] flex h-[var(--vb-studio-control-height,2.25rem)] w-full max-w-xs cursor-pointer items-center justify-between gap-2 rounded-[var(--vb-studio-control-radius,0.625rem)] bg-[var(--vb-studio-input-background)] pr-3 pl-1.5 text-sm shadow-edge transition-[background-color,box-shadow] hover:bg-sidebar disabled:pointer-events-none disabled:cursor-not-allowed disabled:text-subtle-foreground",
          className,
        )}
        {disabled}
      >
        {#if selectedValues.length > 0}
          <div class="flex items-center justify-between w-full min-w-0">
            <div class="flex items-center gap-1 min-w-0 flex-1">
              {#each selectedValues.slice(0, maxCount) as value (value)}
                {@const option = options.find((o) => o.value === value)}
                <Badge variant="outline" size="lg" class="bg-card max-w-28">
                  {#if option?.icon}
                    <Icon icon={option.icon} class="h-3 w-3 shrink-0" />
                  {/if}
                  <span class="truncate">{option?.label}</span>
                </Badge>
              {/each}
              {#if selectedValues.length > maxCount}
                <Badge
                  variant="outline"
                  size="lg"
                  class="bg-card flex-shrink-0"
                >
                  +{selectedValues.length - maxCount}
                </Badge>
              {/if}
            </div>
            <div class="flex items-center shrink-0 ml-2">
              <Icon
                icon={ChevronDown}
                class="text-muted-foreground size-3.5 shrink-0"
              />
            </div>
          </div>
        {:else}
          <div class="flex w-full items-center justify-between gap-2">
            <span class="text-subtle-foreground pl-1.5 text-sm">
              {placeholder}
            </span>
            <Icon
              icon={ChevronDown}
              class="text-muted-foreground size-3.5 shrink-0"
            />
          </div>
        {/if}
      </button>
    {/snippet}
  </PopoverTrigger>
  <PopoverContent
    class="w-auto p-0 max-w-xs rounded-xl"
    align="start"
    preventScroll={modalPopover}
  >
    <Command shouldFilter={!onSearchChange} class="rounded-xl">
      <CommandInput
        placeholder="Search..."
        onkeydown={handleInputKeyDown}
        onValueChange={onSearchChange}
        class="rounded-t-xl"
      />
      <CommandList class="rounded-b-xl">
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup>
          <CommandItem onSelect={toggleAll} class="cursor-pointer">
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div
              class="flex items-center w-full"
              onclick={(event) => {
                event.stopPropagation();
                toggleAll();
              }}
            >
              <Checkbox
                bind:checked={() => allSelected, () => {}}
                onCheckedChange={toggleAll}
                class="mr-2 [&_svg]:!text-primary-foreground"
                onclick={stop}
              />
              <span>(Select All)</span>
            </div>
          </CommandItem>
          {#each options as option (option.value)}
            {@const isSelected = selectedValues.includes(option.value)}
            <CommandItem
              onSelect={() => toggleOption(option)}
              class="cursor-pointer"
            >
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div
                class="flex items-center w-full"
                onclick={(event) => {
                  event.stopPropagation();
                  toggleOption(option);
                }}
              >
                <Checkbox
                  bind:checked={() => isSelected, () => {}}
                  onCheckedChange={() => toggleOption(option)}
                  class="mr-2 [&_svg]:!text-primary-foreground"
                  onclick={stop}
                />
                {#if option.icon}
                  <Icon
                    icon={option.icon}
                    class="mr-2 h-4 w-4 text-muted-foreground"
                  />
                {/if}
                <span>{option.label}</span>
              </div>
            </CommandItem>
          {/each}
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
