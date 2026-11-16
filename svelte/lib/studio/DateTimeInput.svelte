<script lang="ts" module>
  import { CalendarDate, type DateValue } from "@internationalized/date";
  import { expressionToDate, isTimeExpression } from "./time-expressions";

  const pad = (part: number) => String(part).padStart(2, "0");

  /** Format a date for display: "2022-05-01 02:00:00". */
  function formatDisplayDate(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  /** Parse a display date back: "2022-05-01 02:00:00". */
  function parseDisplayDate(input: string): Date | null {
    const match = input.match(
      /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/,
    );
    if (!match) return null;
    const [, year, month, day, hours, minutes, seconds] = match;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  /** Expressions such as "now-2d" show as typed; dates show as "2022-05-01 02:00:00". */
  function getDisplayValue(value: string): string {
    if (isTimeExpression(value)) return value;
    const result = expressionToDate(value);
    return result.valid && result.date ? formatDisplayDate(result.date) : value;
  }

  function toCalendarDate(date: Date): DateValue {
    return new CalendarDate(
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
    );
  }
</script>

<script lang="ts">
  import Button from "./Button.svelte";
  import Calendar from "./Calendar.svelte";
  import Icon from "./Icon.svelte";
  import Input from "./Input.svelte";
  import Popover from "./Popover.svelte";
  import PopoverContent from "./PopoverContent.svelte";
  import PopoverTrigger from "./PopoverTrigger.svelte";
  import { Calendar as CalendarIcon } from "./icons";
  import { cn } from "./utils";

  /** A date and time typed as "now-2d" or "2022-05-01 02:00:00", or picked from a calendar. `value` binds; `onChange` reports the same change. */
  let {
    value = $bindable(),
    onChange,
    id,
    placeholder = "now or now-2d",
    class: className,
    disabled,
    error,
  }: {
    value: string;
    onChange?: (value: string) => void;
    /** The text input's id, for a label. */
    id?: string;
    placeholder?: string;
    class?: string;
    disabled?: boolean;
    error?: string;
  } = $props();

  const timeId = $props.id();
  let calendarOpen = $state(false);
  let content = $state<HTMLElement | null>(null);
  let inputValue = $state(getDisplayValue(value));
  let localError = $state<string | undefined>();
  let isFocused = false;
  let previousValue = value;

  // The text follows the value from outside, except while it is being typed in.
  $effect.pre(() => {
    if (value === previousValue) return;
    previousValue = value;
    if (!isFocused) inputValue = getDisplayValue(value);
  });

  function commit(next: string) {
    previousValue = next;
    value = next;
    onChange?.(next);
  }

  function handleInputBlur() {
    isFocused = false;
    const trimmed = inputValue.trim();
    localError = undefined;
    if (isTimeExpression(trimmed)) {
      commit(trimmed);
      return;
    }
    const parsedDate = parseDisplayDate(trimmed);
    if (parsedDate) {
      commit(parsedDate.toISOString());
      inputValue = formatDisplayDate(parsedDate);
      return;
    }
    const result = expressionToDate(trimmed);
    if (result.valid && result.date) {
      commit(trimmed);
      inputValue = formatDisplayDate(result.date);
      return;
    }
    inputValue = getDisplayValue(value);
  }

  function handleDateSelect(selected: DateValue | undefined) {
    if (selected) {
      const current = expressionToDate(value).date ?? new Date();
      const date = new Date(
        selected.year,
        selected.month - 1,
        selected.day,
        current.getHours(),
        current.getMinutes(),
        0,
        0,
      );
      inputValue = formatDisplayDate(date);
      commit(date.toISOString());
      localError = undefined;
    }
    calendarOpen = false;
  }

  function handleTimeChange(
    event: Event & { currentTarget: HTMLInputElement },
  ) {
    const [hours, minutes] = event.currentTarget.value.split(":").map(Number);
    const date = expressionToDate(value).date ?? new Date();
    date.setHours(hours || 0);
    date.setMinutes(minutes || 0);
    date.setSeconds(0);
    date.setMilliseconds(0);
    inputValue = formatDisplayDate(date);
    commit(date.toISOString());
  }

  const currentDate = $derived.by(() => {
    const result = expressionToDate(value);
    return result.valid ? result.date : new Date();
  });
  const timeValue = $derived(
    currentDate
      ? `${pad(currentDate.getHours())}:${pad(currentDate.getMinutes())}`
      : "",
  );
  const displayError = $derived(error || localError);
</script>

<div class={cn("tw:flex tw:gap-1", className)}>
  <div class="tw:relative tw:flex-1">
    <Input
      {id}
      bind:value={inputValue}
      oninput={() => (localError = undefined)}
      onfocus={() => (isFocused = true)}
      onblur={handleInputBlur}
      {placeholder}
      {disabled}
      class={cn(
        "tw:h-8 tw:text-sm",
        displayError &&
          "tw:border-destructive tw:focus-visible:ring-destructive",
      )}
    />
    {#if displayError}
      <p class="tw:text-destructive tw:mt-1 tw:text-xs tw:text-pretty">
        {displayError}
      </p>
    {/if}
  </div>
  <Popover bind:open={calendarOpen}>
    <PopoverTrigger>
      {#snippet child({ props })}
        <Button
          {...props}
          variant="outline"
          size="icon"
          class="tw:h-8 tw:w-8 tw:shrink-0"
          {disabled}
        >
          <Icon icon={CalendarIcon} class="tw:h-4 tw:w-4" />
        </Button>
      {/snippet}
    </PopoverTrigger>
    <!-- Bits UI would focus the first button; react-day-picker's `initialFocus` puts focus on the day. -->
    <PopoverContent
      bind:ref={content}
      class="tw:w-auto tw:p-0"
      align="end"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        content
          ?.querySelector<HTMLElement>(
            "[data-bits-day][data-focused]:not([data-outside-month])",
          )
          ?.focus();
      }}
    >
      <Calendar
        mode="single"
        selected={currentDate ? toCalendarDate(currentDate) : undefined}
        onSelect={handleDateSelect}
      />
      <div class="tw:border-border tw:border-t tw:p-3">
        <label
          for={timeId}
          class="tw:text-muted-foreground tw:mb-1.5 tw:block tw:text-xs"
          >Time</label
        >
        <Input
          id={timeId}
          type="time"
          value={timeValue}
          oninput={handleTimeChange}
          class="tw:h-8 tw:text-sm"
        />
      </div>
    </PopoverContent>
  </Popover>
</div>
