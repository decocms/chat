/** Where a hook's ⏸/❓ question goes when it comes with no thread: the newer of the request the Claude acked (by
 *  when that request was written) and its own latest post (last 30 min). `known` filters threads that still exist. */
export function askThread(
  acked: { thread: string; ts: number } | undefined,
  last: { thread: string; ts: number } | undefined,
  known: (thread: string) => boolean,
): string {
  if (last && known(last.thread) && (!acked || last.ts > acked.ts)) return last.thread;
  return acked?.thread ?? "";
}
