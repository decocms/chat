import {
  type DateValue,
  getDayOfWeek,
  isSameDay,
  isSameMonth,
} from "@internationalized/date";

/** The React component took `Date`s for react-day-picker; Bits UI works on `DateValue`s, so the port does too. */
export type CalendarRange = {
  from: DateValue | undefined;
  to?: DateValue | undefined;
};

/** What react-day-picker called a matcher: a day, a predicate, an open or closed interval, or days of the week (0 is Sunday). */
export type CalendarMatcher =
  | DateValue
  | ((date: DateValue) => boolean)
  | { before?: DateValue; after?: DateValue }
  | { from: DateValue; to: DateValue }
  | { dayOfWeek: number[] };

export type CalendarDisabled = boolean | CalendarMatcher | CalendarMatcher[];

function matches(date: DateValue, matcher: CalendarMatcher): boolean {
  if (typeof matcher === "function") return matcher(date);
  if ("dayOfWeek" in matcher) {
    return matcher.dayOfWeek.includes(getDayOfWeek(date, "en-US"));
  }
  if ("from" in matcher) {
    return date.compare(matcher.from) >= 0 && date.compare(matcher.to) <= 0;
  }
  if ("before" in matcher || "after" in matcher) {
    return (
      (matcher.before !== undefined && date.compare(matcher.before) < 0) ||
      (matcher.after !== undefined && date.compare(matcher.after) > 0)
    );
  }
  return "calendar" in matcher && isSameDay(date, matcher);
}

export function isDateMatched(
  date: DateValue,
  disabled: CalendarDisabled | undefined,
): boolean {
  if (disabled === undefined || typeof disabled === "boolean") return false;
  if (Array.isArray(disabled)) {
    return disabled.some((matcher) => matches(date, matcher));
  }
  return matches(date, disabled);
}

/** react-day-picker's range rule: a click moves the nearer end of a complete range instead of starting a new one. */
export function addToRange(
  day: DateValue,
  range: CalendarRange | undefined,
): CalendarRange | undefined {
  const { from, to } = range ?? { from: undefined };
  if (from && to) {
    if (isSameDay(to, day) && isSameDay(from, day)) return undefined;
    if (isSameDay(to, day)) return { from: to, to: undefined };
    if (isSameDay(from, day)) return undefined;
    if (from.compare(day) > 0) return { from: day, to };
    return { from, to: day };
  }
  if (to) {
    return day.compare(to) > 0 ? { from: to, to: day } : { from: day, to };
  }
  if (from) {
    return day.compare(from) < 0 ? { from: day, to: from } : { from, to: day };
  }
  return { from: day, to: undefined };
}

/** react-day-picker opens on today's month and puts focus on the selected day only when that month shows it. */
export function initialFocus(
  selected: DateValue | undefined,
  month: DateValue,
): DateValue {
  return selected && isSameMonth(selected, month) ? selected : month;
}
