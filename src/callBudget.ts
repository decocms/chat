// The month's screen-share budget (src/calls.ts). Pure, so a test can load it without the Worker runtime.
/** Over this many GB in the month, a screen share is refused and the app offers a Google Meet link instead. */
export const CALL_SCREEN_LIMIT_GB = 900;
export const GB = 1024 ** 3;
export const usageMonth = (now = Date.now()) => new Date(now).toISOString().slice(0, 7);
export const overScreenLimit = (bytes: number, limitGb: number) => bytes >= limitGb * GB;
