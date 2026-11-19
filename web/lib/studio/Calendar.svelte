<script lang="ts" module>
  import type { DateValue } from "@internationalized/date";
  import type { HTMLAttributes } from "svelte/elements";
  import type { CalendarDisabled, CalendarRange } from "./calendar";

  type CalendarAttributes = Omit<
    HTMLAttributes<HTMLDivElement>,
    "style" | "class" | "children" | "placeholder" | "id"
  > & { id?: string };
  type CalendarCommonProps = CalendarAttributes & {
    /** The month on screen (any day in it); defaults to today's. Binds, so it also reports navigation. */
    month?: DateValue;
    numberOfMonths?: number;
    showOutsideDays?: boolean;
    /** `true` disables every day; a matcher disables the days it matches. */
    disabled?: CalendarDisabled;
    /** Move focus to the selected day, or today, when the calendar mounts. */
    initialFocus?: boolean;
    locale?: string;
    /** 0 is Sunday. */
    weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    class?: string;
    ref?: HTMLElement | null;
  };

  export type CalendarProps = CalendarCommonProps &
    (
      | {
          mode?: "single";
          selected?: DateValue;
          onSelect?: (selected: DateValue | undefined) => void;
        }
      | {
          mode: "multiple";
          selected?: DateValue[];
          onSelect?: (selected: DateValue[]) => void;
        }
      | {
          mode: "range";
          selected?: CalendarRange;
          onSelect?: (selected: CalendarRange | undefined) => void;
        }
    );

  const CAPTION = { month: "long", year: "numeric" } as const;
  const CELL =
    "relative p-0 text-center text-sm tabular-nums focus-within:relative focus-within:z-20 data-selected:bg-accent";
  const CELL_SINGLE = "data-selected:rounded-md";
  const CELL_RANGE =
    "data-range-end:rounded-r-md data-range-start:rounded-l-md first:data-selected:rounded-l-md last:data-selected:rounded-r-md";
  const DAY = "size-8 p-0 font-normal";
  const DAY_DISABLED =
    "data-disabled:pointer-events-none data-disabled:not-data-selected:text-muted-foreground data-disabled:not-data-selected:opacity-40";
  const DAY_SELECTED =
    "data-selected:bg-primary data-selected:text-primary-foreground data-selected:hover:bg-primary data-selected:hover:text-primary-foreground";
  const DAY_SELECTED_OUTSIDE =
    "data-selected:bg-primary data-selected:text-muted-foreground data-selected:hover:bg-primary data-selected:hover:text-muted-foreground";
  const DAY_RANGE_EDGE =
    "data-range-start:bg-primary data-range-start:text-primary-foreground data-range-start:hover:bg-primary data-range-start:hover:text-primary-foreground data-range-end:bg-primary data-range-end:text-primary-foreground data-range-end:hover:bg-primary data-range-end:hover:text-primary-foreground";
  const DAY_RANGE_MIDDLE =
    "data-range-middle:bg-accent data-range-middle:text-accent-foreground";
  const DAY_RANGE_MIDDLE_OUTSIDE =
    "data-range-middle:bg-accent data-range-middle:text-muted-foreground data-range-middle:hover:text-muted-foreground";
  const ARROWS: Record<string, number | undefined> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
    ArrowDown: 7,
  };
  const NAV = "size-7 bg-transparent p-0 opacity-50 hover:opacity-100";
</script>

<script lang="ts">
  import {
    DateFormatter,
    getLocalTimeZone,
    isSameDay,
    isSameMonth,
    isToday,
    parseDate,
    today,
  } from "@internationalized/date";
  import {
    Calendar as CalendarPrimitive,
    RangeCalendar as RangeCalendarPrimitive,
  } from "bits-ui";
  import type { Month } from "bits-ui";
  import { onMount, tick, untrack } from "svelte";
  import { buttonVariants } from "./button";
  import {
    addToRange,
    initialFocus as initialFocusDate,
    isDateMatched,
  } from "./calendar";
  import Icon from "./Icon.svelte";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `Calendar` (react-day-picker) onto Bits UI: `mode` picks one day, several, or a range. */
  let {
    selected = $bindable(),
    month = $bindable(),
    ref = $bindable(null),
    numberOfMonths = 1,
    showOutsideDays = true,
    disabled,
    initialFocus = false,
    locale = "en-US",
    weekStartsOn = 0,
    class: className,
    ...props
  }: CalendarProps = $props();

  const timeZone = getLocalTimeZone();
  const range = $derived(props.mode === "range");
  const Cell = $derived(
    range ? RangeCalendarPrimitive.Cell : CalendarPrimitive.Cell,
  );
  const Day = $derived(
    range ? RangeCalendarPrimitive.Day : CalendarPrimitive.Day,
  );
  const caption = $derived(new DateFormatter(locale, CAPTION));
  const attributes: CalendarAttributes = $derived.by(() => {
    const { mode: _mode, onSelect: _onSelect, ...html } = props;
    return html;
  });
  const shared = $derived({
    numberOfMonths,
    weekStartsOn,
    weekdayFormat: "short" as const,
    disabled: disabled === true,
    isDateDisabled: (date: DateValue) => isDateMatched(date, disabled),
    disableDaysOutsideMonth: !showOutsideDays,
    locale,
  });

  const single = $derived(
    selected !== undefined && !Array.isArray(selected) && !("from" in selected)
      ? selected
      : undefined,
  );
  const multiple = $derived(Array.isArray(selected) ? selected : []);
  const span = $derived(
    selected !== undefined && !Array.isArray(selected) && "from" in selected
      ? selected
      : undefined,
  );
  const spanValue = $derived({ start: span?.from, end: span?.to });

  if (month === undefined) {
    month = untrack(() => {
      const now = today(timeZone);
      const first = multiple.find((date) => isSameMonth(date, now));
      return initialFocusDate(single ?? span?.from ?? first, now);
    });
  }

  // react-day-picker's selection rules, applied here so a click never changes the month on screen.
  function select(date: DateValue) {
    if (disabled === true || isDateMatched(date, disabled)) return;
    switch (props.mode) {
      case "range": {
        const next = addToRange(date, span);
        selected = next;
        props.onSelect?.(next);
        break;
      }
      case "multiple": {
        const kept = multiple.filter((day) => !isSameDay(day, date));
        const next = kept.length === multiple.length ? [...kept, date] : kept;
        selected = next;
        props.onSelect?.(next);
        break;
      }
      case "single":
      case undefined: {
        const next = single && isSameDay(single, date) ? undefined : date;
        selected = next;
        props.onSelect?.(next);
        break;
      }
      default: {
        const unhandled: never = props;
        throw new Error(`Unknown calendar mode: ${String(unhandled)}`);
      }
    }
  }
  function click(event: MouseEvent, date: DateValue) {
    event.preventDefault();
    select(date);
  }
  function keydown(event: KeyboardEvent) {
    if (!(event.target instanceof HTMLElement)) return;
    const { bitsDay, value, outsideMonth } = event.target.dataset;
    if (bitsDay === undefined || !value) return;
    const date = parseDate(value.slice(0, 10));
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(date);
      return;
    }
    const days = ARROWS[event.key];
    if (days === undefined || outsideMonth === undefined) return;
    // A clicked outside day keeps focus without its month on screen, which Bits UI's own arrow keys do not expect.
    event.preventDefault();
    const next = date.add({ days });
    month = next;
    void tick().then(() => {
      ref
        ?.querySelector<HTMLElement>(
          `[data-bits-day][data-value="${next.toString()}"]:not([data-outside-month])`,
        )
        ?.focus();
    });
  }
  // Bits UI moves the month to a newly selected day by handing that same object back; react-day-picker stays put.
  function setMonth(next: DateValue | undefined) {
    if (next === undefined) return;
    if (next === (single ?? span?.from ?? multiple.at(-1))) return;
    month = next;
  }
  // Bits UI's range calendar has no `initialFocus`, so the port moves focus itself.
  onMount(() => {
    if (!range || !initialFocus) return;
    ref?.querySelector<HTMLElement>("[data-bits-day][data-focused]")?.focus();
  });

  function dayClass(date: DateValue, shown: DateValue): string {
    const outside = !isSameMonth(date, shown);
    return cn(
      buttonVariants({ variant: "ghost" }),
      DAY,
      DAY_DISABLED,
      isToday(date, timeZone) && "bg-accent text-accent-foreground",
      outside && "text-muted-foreground",
      outside && !showOutsideDays && "invisible",
      range ? DAY_RANGE_EDGE : outside ? DAY_SELECTED_OUTSIDE : DAY_SELECTED,
      range && (outside ? DAY_RANGE_MIDDLE_OUTSIDE : DAY_RANGE_MIDDLE),
    );
  }
</script>

{#snippet grids(months: Month<DateValue>[], weekdays: string[])}
  <div class="flex flex-col gap-2 md:flex-row">
    {#each months as shown, index (shown.value.toString())}
      <div class="flex flex-col gap-4">
        <div class="relative flex w-full items-center justify-center pt-1">
          <div
            class="text-sm font-medium"
            aria-live="polite"
            role="presentation"
          >
            {caption.format(shown.value.toDate(timeZone))}
          </div>
          <div class="flex items-center gap-1">
            {#if index === 0}
              <CalendarPrimitive.PrevButton>
                {#snippet child({ props: button })}
                  <button
                    {...button}
                    name="previous-month"
                    aria-label="Go to previous month"
                    class={cn(
                      buttonVariants({ variant: "outline" }),
                      NAV,
                      "left-1",
                    )}
                  >
                    <Icon icon="chevron-left" class="size-4" />
                  </button>
                {/snippet}
              </CalendarPrimitive.PrevButton>
            {/if}
            {#if index === months.length - 1}
              <CalendarPrimitive.NextButton>
                {#snippet child({ props: button })}
                  <button
                    {...button}
                    name="next-month"
                    aria-label="Go to next month"
                    class={cn(
                      buttonVariants({ variant: "outline" }),
                      NAV,
                      "right-1",
                    )}
                  >
                    <Icon icon="chevron-right" class="size-4" />
                  </button>
                {/snippet}
              </CalendarPrimitive.NextButton>
            {/if}
          </div>
        </div>
        <CalendarPrimitive.Grid class="w-full border-collapse space-x-1">
          <CalendarPrimitive.GridHead>
            <CalendarPrimitive.GridRow class="flex">
              {#each weekdays as weekday (weekday)}
                <CalendarPrimitive.HeadCell
                  class="text-muted-foreground w-8 rounded-md text-[0.8rem] font-normal tabular-nums"
                  >{weekday.slice(0, 2)}</CalendarPrimitive.HeadCell
                >
              {/each}
            </CalendarPrimitive.GridRow>
          </CalendarPrimitive.GridHead>
          <CalendarPrimitive.GridBody>
            {#each shown.weeks as week (week[0]?.toString())}
              <CalendarPrimitive.GridRow class="mt-2 flex w-full">
                {#each week as date (date.toString())}
                  <Cell
                    {date}
                    month={shown.value}
                    class={cn(CELL, range ? CELL_RANGE : CELL_SINGLE)}
                  >
                    <Day
                      class={dayClass(date, shown.value)}
                      onclick={(event: MouseEvent) => click(event, date)}
                    />
                  </Cell>
                {/each}
              </CalendarPrimitive.GridRow>
            {/each}
          </CalendarPrimitive.GridBody>
        </CalendarPrimitive.Grid>
      </div>
    {/each}
  </div>
{/snippet}

{#if props.mode === "range"}
  <RangeCalendarPrimitive.Root
    bind:ref
    value={spanValue}
    bind:placeholder={() => month, setMonth}
    data-slot="calendar"
    {...attributes}
    {...shared}
    onkeydown={(event) => {
      attributes.onkeydown?.(event);
      if (!event.defaultPrevented) keydown(event);
    }}
    class={cn("p-3 leading-[1.5]", className)}
  >
    {#snippet children({ months, weekdays })}
      {@render grids(months, weekdays)}
    {/snippet}
  </RangeCalendarPrimitive.Root>
{:else if props.mode === "multiple"}
  <CalendarPrimitive.Root
    type="multiple"
    bind:ref
    value={multiple}
    bind:placeholder={() => month, setMonth}
    data-slot="calendar"
    {...attributes}
    {...shared}
    {initialFocus}
    onkeydown={(event) => {
      attributes.onkeydown?.(event);
      if (!event.defaultPrevented) keydown(event);
    }}
    class={cn("p-3 leading-[1.5]", className)}
  >
    {#snippet children({ months, weekdays })}
      {@render grids(months, weekdays)}
    {/snippet}
  </CalendarPrimitive.Root>
{:else}
  <CalendarPrimitive.Root
    type="single"
    bind:ref
    value={single}
    bind:placeholder={() => month, setMonth}
    data-slot="calendar"
    {...attributes}
    {...shared}
    {initialFocus}
    onkeydown={(event) => {
      attributes.onkeydown?.(event);
      if (!event.defaultPrevented) keydown(event);
    }}
    class={cn("p-3 leading-[1.5]", className)}
  >
    {#snippet children({ months, weekdays })}
      {@render grids(months, weekdays)}
    {/snippet}
  </CalendarPrimitive.Root>
{/if}
