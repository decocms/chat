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
          "tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:aria-invalid:bg-destructive/10 tw:aria-invalid:shadow-[inset_0_0_0_1px_var(--vb-destructive)] tw:flex tw:h-[var(--vb-studio-control-height,2.25rem)] tw:w-full tw:max-w-xs tw:cursor-pointer tw:items-center tw:justify-between tw:gap-2 tw:rounded-[var(--vb-studio-control-radius,0.625rem)] tw:bg-[var(--vb-studio-input-background)] tw:pr-3 tw:pl-1.5 tw:text-sm tw:shadow-edge tw:transition-[background-color,box-shadow] tw:hover:bg-sidebar tw:disabled:pointer-events-none tw:disabled:cursor-not-allowed tw:disabled:text-subtle-foreground",
          className,
        )}
        {disabled}
      >
        {#if selectedValues.length > 0}
          <div
            class="tw:flex tw:items-center tw:justify-between tw:w-full tw:min-w-0"
          >
            <div class="tw:flex tw:items-center tw:gap-1 tw:min-w-0 tw:flex-1">
              {#each selectedValues.slice(0, maxCount) as value (value)}
                {@const option = options.find((o) => o.value === value)}
                <Badge
                  variant="outline"
                  size="lg"
                  class="tw:bg-card tw:max-w-28"
                >
                  {#if option?.icon}
                    <Icon
                      icon={option.icon}
                      class="tw:h-3 tw:w-3 tw:shrink-0"
                    />
                  {/if}
                  <span class="tw:truncate">{option?.label}</span>
                </Badge>
              {/each}
              {#if selectedValues.length > maxCount}
                <Badge
                  variant="outline"
                  size="lg"
                  class="tw:bg-card tw:flex-shrink-0"
                >
                  +{selectedValues.length - maxCount}
                </Badge>
              {/if}
            </div>
            <div class="tw:flex tw:items-center tw:shrink-0 tw:ml-2">
              <Icon
                icon={ChevronDown}
                class="tw:text-muted-foreground tw:size-3.5 tw:shrink-0"
              />
            </div>
          </div>
        {:else}
          <div
            class="tw:flex tw:w-full tw:items-center tw:justify-between tw:gap-2"
          >
            <span class="tw:text-subtle-foreground tw:pl-1.5 tw:text-sm">
              {placeholder}
            </span>
            <Icon
              icon={ChevronDown}
              class="tw:text-muted-foreground tw:size-3.5 tw:shrink-0"
            />
          </div>
        {/if}
      </button>
    {/snippet}
  </PopoverTrigger>
  <PopoverContent
    class="tw:w-auto tw:p-0 tw:max-w-xs tw:rounded-xl"
    align="start"
    preventScroll={modalPopover}
  >
    <Command shouldFilter={!onSearchChange} class="tw:rounded-xl">
      <CommandInput
        placeholder="Search..."
        onkeydown={handleInputKeyDown}
        onValueChange={onSearchChange}
        class="tw:rounded-t-xl"
      />
      <CommandList class="tw:rounded-b-xl">
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup>
          <CommandItem onSelect={toggleAll} class="tw:cursor-pointer">
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div
              class="tw:flex tw:items-center tw:w-full"
              onclick={(event) => {
                event.stopPropagation();
                toggleAll();
              }}
            >
              <Checkbox
                bind:checked={() => allSelected, () => {}}
                onCheckedChange={toggleAll}
                class="tw:mr-2 tw:[&_svg]:!text-primary-foreground"
                onclick={stop}
              />
              <span>(Select All)</span>
            </div>
          </CommandItem>
          {#each options as option (option.value)}
            {@const isSelected = selectedValues.includes(option.value)}
            <CommandItem
              onSelect={() => toggleOption(option)}
              class="tw:cursor-pointer"
            >
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div
                class="tw:flex tw:items-center tw:w-full"
                onclick={(event) => {
                  event.stopPropagation();
                  toggleOption(option);
                }}
              >
                <Checkbox
                  bind:checked={() => isSelected, () => {}}
                  onCheckedChange={() => toggleOption(option)}
                  class="tw:mr-2 tw:[&_svg]:!text-primary-foreground"
                  onclick={stop}
                />
                {#if option.icon}
                  <Icon
                    icon={option.icon}
                    class="tw:mr-2 tw:h-4 tw:w-4 tw:text-muted-foreground"
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
