// Reuse ICU's formatter across message rows and room projections. Keep the
// browser's locale/time-zone defaults and the existing invalid-date behavior.
let cached: { locale: string; formatter: Intl.DateTimeFormat } | undefined;
let cachedDate: { locale: string; formatter: Intl.DateTimeFormat } | undefined;
export function resetChatTime() {
  cached = undefined;
  cachedDate = undefined;
}
export function chatTime(locale: string, ts: number): string {
  const date = new Date(ts);
  if (!Number.isFinite(date.getTime())) return date.toLocaleTimeString(locale);
  if (cached?.locale !== locale)
    cached = {
      locale,
      // 24h everywhere (17:58, not 05:58 PM; Gui #3586): exact, and the same in every locale.
      formatter: new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }),
    };
  return cached.formatter.format(date);
}

export function chatDateTime(locale: string, ts: number): string {
  const date = new Date(ts);
  if (!Number.isFinite(date.getTime())) return date.toLocaleString(locale);
  if (cachedDate?.locale !== locale)
    cachedDate = {
      locale,
      formatter: new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
      }),
    };
  return cachedDate.formatter.format(date);
}

let zoneCache: Intl.DateTimeFormat | undefined;
/** The viewer's UTC offset at that moment, e.g. "GMT-3": shown small next to the time so it is exact. */
export function chatZone(ts: number): string {
  const date = new Date(ts);
  if (!Number.isFinite(date.getTime())) return "";
  zoneCache ??= new Intl.DateTimeFormat("en-US", {
    timeZoneName: "shortOffset",
  });
  return (
    zoneCache.formatToParts(date).find((p) => p.type === "timeZoneName")
      ?.value ?? ""
  );
}
