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
        class={cn("min-w-[160px] justify-between gap-1.5", className)}
        {disabled}
      >
        <div class="flex items-center gap-1.5">
          <Icon icon={Clock} class="text-muted-foreground size-4" />
          <span class="text-sm">{displayText}</span>
        </div>
        <Icon icon={ChevronDown} class="text-muted-foreground size-4" />
      </Button>
    {/snippet}
  </PopoverTrigger>
  <!-- An instant exit keeps the popover from blinking when a re-render restarts its exit animation. -->
  <PopoverContent
    class="w-[540px] p-0 data-[state=closed]:[animation-duration:0s]"
    align="end"
    sideOffset={4}
    onCloseAutoFocus={(event) => event.preventDefault()}
  >
    <div class="flex">
      <div class="border-border flex-1 border-r p-4">
        <h4 class="mb-4 text-sm font-medium text-balance">
          {labels?.absoluteTimeRange ?? "Absolute time range"}
        </h4>
        <div class="space-y-4">
          <div>
            <label
              for={fromId}
              class="text-muted-foreground mb-1.5 block text-xs"
              >{labels?.from ?? "From"}</label
            >
            <DateTimeInput
              id={fromId}
              bind:value={localFrom}
              placeholder="now-24h"
            />
          </div>
          <div>
            <label for={toId} class="text-muted-foreground mb-1.5 block text-xs"
              >{labels?.to ?? "To"}</label
            >
            <DateTimeInput id={toId} bind:value={localTo} placeholder="now" />
          </div>
          {#if validationError}
            <p class="text-destructive text-xs text-pretty">
              {validationError}
            </p>
          {/if}
          <Button onclick={handleApply} class="w-full" size="sm">
            {labels?.applyTimeRange ?? "Apply time range"}
          </Button>
        </div>
      </div>
      <div class="w-[200px]">
        <ScrollArea class="h-[280px]">
          <div class="p-2">
            {#each quickRanges as range (range.value)}
              <button
                type="button"
                onclick={() => handleQuickRangeSelect(range)}
                class={cn(
                  "w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed",
                  "hover:bg-accent hover:text-accent-foreground",
                  value.from === range.from &&
                    value.to === range.to &&
                    "bg-accent text-accent-foreground font-medium",
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
