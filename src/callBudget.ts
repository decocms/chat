// The month's screen-share budget (src/calls.ts). Pure, so a test can load it without the Worker runtime.
/** Over this many GB in the month, a screen share is refused and the app offers a Google Meet link instead. */
export const CALL_SCREEN_LIMIT_GB = 900;
export const GB = 1024 ** 3;
export const usageMonth = (now = Date.now()) => new Date(now).toISOString().slice(0, 7);
export const overScreenLimit = (bytes: number, limitGb: number) => bytes >= limitGb * GB;

/** Rooms whose calls are recorded: CALL_RECORD_ROOMS is a list of room ids, or "*" for every room. */
export const recordsRoom = (rooms: string | undefined, bookId: string) => {
  const list = (rooms ?? "").split(",").map((r) => r.trim()).filter(Boolean);
  return list.includes("*") || list.includes(bookId);
};

// The account's real traffic, from Cloudflare's analytics API (GraphQL). The SFU and TURN share the 1,000 GB.
export const EGRESS_QUERY = `query($account: String!, $from: Date!, $to: Date!) { viewer { accounts(filter: { accountTag: $account }) {
  sfu: callsUsageAdaptiveGroups(limit: 1, filter: { date_geq: $from, date_leq: $to }) { sum { egressBytes } }
  turn: callsTurnUsageAdaptiveGroups(limit: 1, filter: { date_geq: $from, date_leq: $to }) { sum { egressBytes } }
} } }`;
/** The first and the last day of the month of `now`, as the API wants them (UTC). */
export const monthDays = (now = Date.now()): [string, string] => {
  const d = new Date(now), last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return [`${usageMonth(now)}-01`, last.toISOString().slice(0, 10)];
};
/** The bytes in the API's answer to EGRESS_QUERY, or null when the answer is not what we expect. */
export function egressFrom(answer: unknown): number | null {
  const account = (answer as { data?: { viewer?: { accounts?: Record<string, { sum?: { egressBytes?: number } }[]>[] } } } | null)?.data?.viewer?.accounts?.[0];
  if (!account) return null;
  const bytes = (rows: { sum?: { egressBytes?: number } }[] | undefined) => (rows ?? []).reduce((n, row) => n + (Number(row.sum?.egressBytes) || 0), 0);
  return bytes(account.sfu) + bytes(account.turn);
}

