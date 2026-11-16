<script lang="ts" module>
  export type TimeRange = { from: string; to: string };
</script>

<script lang="ts">
  import Button from "./Button.svelte";
  import DateTimeInput from "./DateTimeInput.svelte";
  import Icon from "./Icon.svelte";
  import Popover from "./Popover.svelte";
  import PopoverContent from "./PopoverContent.svelte";
  import PopoverTrigger from "./PopoverTrigger.svelte";
  import ScrollArea from "./ScrollArea.svelte";
  import { ChevronDown, Clock } from "./icons";
  import {
    expressionToDate,
    getTimeRangeDisplayText,
    QUICK_RANGES,
    type QuickRange,
  } from "./time-expressions";
  import { cn } from "./utils";

  /** A quick range such as "Last 24 hours", or an absolute one typed or picked. `value` binds; `onChange` reports the same change. */
  let {
    value = $bindable(),
    onChange,
    class: className,
    disabled,
    quickRanges = QUICK_RANGES,
    labels,
  }: {
    value: TimeRange;
    onChange?: (value: TimeRange) => void;
    class?: string;
    disabled?: boolean;
    /** Quick ranges to display. Defaults to QUICK_RANGES. */
    quickRanges?: QuickRange[];
    /** Optional translations for the UI labels. */
    labels?: {
      absoluteTimeRange?: string;
      from?: string;
      to?: string;
      applyTimeRange?: string;
    };
  } = $props();

  const fromId = $props.id();
  const toId = `${fromId}-to`;
  let open = $state(false);
  let localFrom = $state(value.from);
  let localTo = $state(value.to);
  let validationError = $state<string | null>(null);
  let previous = { from: value.from, to: value.to };

  $effect.pre(() => {
    if (previous.from === value.from && previous.to === value.to) return;
    previous = { from: value.from, to: value.to };
    localFrom = value.from;
    localTo = value.to;
  });

  function commit(next: TimeRange) {
    value = next;
    onChange?.(next);
  }

  function handleQuickRangeSelect(range: QuickRange) {
    previous = { from: range.from, to: range.to };
    localFrom = range.from;
    localTo = range.to;
    open = false;
    commit({ from: range.from, to: range.to });
  }

  function handleApply() {
    const fromResult = expressionToDate(localFrom);
    const toResult = expressionToDate(localTo);
    if (!fromResult.valid || !fromResult.date) {
      validationError = "Invalid 'From' date";
      return;
    }
    if (!toResult.valid || !toResult.date) {
      validationError = "Invalid 'To' date";
      return;
    }
    if (fromResult.date >= toResult.date) {
      validationError = "'From' must be before 'To'";
      return;
    }
    validationError = null;
    commit({ from: localFrom, to: localTo });
    open = false;
  }

  const displayText = $derived(
    getTimeRangeDisplayText(value.from, value.to, quickRanges),
  );
</script>

<Popover bind:open>
  <PopoverTrigger>
    {#snippet child({ props })}
      <Button
        {...props}
        variant="outline"
        class={cn("tw:min-w-[160px] tw:justify-between tw:gap-1.5", className)}
        {disabled}
      >
        <div class="tw:flex tw:items-center tw:gap-1.5">
          <Icon icon={Clock} class="tw:text-muted-foreground tw:size-4" />
          <span class="tw:text-sm">{displayText}</span>
        </div>
        <Icon icon={ChevronDown} class="tw:text-muted-foreground tw:size-4" />
      </Button>
    {/snippet}
  </PopoverTrigger>
  <!-- An instant exit keeps the popover from blinking when a re-render restarts its exit animation. -->
  <PopoverContent
    class="tw:w-[540px] tw:p-0 tw:data-[state=closed]:[animation-duration:0s]"
    align="end"
    sideOffset={4}
    onCloseAutoFocus={(event) => event.preventDefault()}
  >
    <div class="tw:flex">
      <div class="tw:border-border tw:flex-1 tw:border-r tw:p-4">
        <h4 class="tw:mb-4 tw:text-sm tw:font-medium tw:text-balance">
          {labels?.absoluteTimeRange ?? "Absolute time range"}
        </h4>
        <div class="tw:space-y-4">
          <div>
            <label
              for={fromId}
              class="tw:text-muted-foreground tw:mb-1.5 tw:block tw:text-xs"
              >{labels?.from ?? "From"}</label
            >
            <DateTimeInput
              id={fromId}
              bind:value={localFrom}
              placeholder="now-24h"
            />
          </div>
          <div>
            <label
              for={toId}
              class="tw:text-muted-foreground tw:mb-1.5 tw:block tw:text-xs"
              >{labels?.to ?? "To"}</label
            >
            <DateTimeInput id={toId} bind:value={localTo} placeholder="now" />
          </div>
          {#if validationError}
            <p class="tw:text-destructive tw:text-xs tw:text-pretty">
              {validationError}
            </p>
          {/if}
          <Button onclick={handleApply} class="tw:w-full" size="sm">
            {labels?.applyTimeRange ?? "Apply time range"}
          </Button>
        </div>
      </div>
      <div class="tw:w-[200px]">
        <ScrollArea class="tw:h-[280px]">
          <div class="tw:p-2">
            {#each quickRanges as range (range.value)}
              <button
                type="button"
                onclick={() => handleQuickRangeSelect(range)}
                class={cn(
                  "tw:w-full tw:cursor-pointer tw:rounded-lg tw:px-3 tw:py-2 tw:text-left tw:text-sm tw:transition-colors tw:disabled:cursor-not-allowed",
                  "tw:hover:bg-accent tw:hover:text-accent-foreground",
                  value.from === range.from &&
                    value.to === range.to &&
                    "tw:bg-accent tw:text-accent-foreground tw:font-medium",
                )}
              >
                {range.label}
              </button>
            {/each}
          </div>
        </ScrollArea>
      </div>
    </div>
  </PopoverContent>
</Popover>
