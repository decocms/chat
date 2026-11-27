// The room socket URL inside the Book, built by the worker's /ws/:id route (src/index.ts). Pure, for its test.
/** The room socket's URL inside the Book. t = the thread the app opens on; rc = a reconnect's previous close code
 *  (ws_state); peek=1 = a look from the Home Inbox (not a read); lite=1 = send hello, not state (the app reads the room over HTTP); since, at, eh = the room the app
 *  already has (Book.resumeOf). The worker used to drop since/at/eh, so
 *  no open ever resumed and every one sent the whole room (Nov 2026). Numbers only, and eh is a short hash. */
export function bookSocketUrl(
  id: string,
  query: (name: string) => string | undefined,
) {
  const digits = (name: string, max: number) =>
    (query(name) ?? "").replace(/\D/g, "").slice(0, max);
  const rc = digits("rc", 4),
    since = digits("since", 15),
    at = digits("at", 15);
  const eh = (query("eh") ?? "").replace(/[^\w-]/g, "").slice(0, 64);
  let url = `https://book/ws?book=${id}&t=${encodeURIComponent(query("t") ?? "main")}`;
  if (query("lite") === "1") url += "&lite=1";
  if (rc) url += `&rc=${rc}`;
  if (since && at) url += `&since=${since}&at=${at}${eh ? `&eh=${eh}` : ""}`;
  // ed=1: the app merges a resume's epics by id (Book.epicsDelta).
  if (query("ed") === "1") url += "&ed=1";
  // The call's own socket (Book.isCallSocket): it opens no room, only the call.
  if (query("call") === "1") url += "&call=1";
  // The Home Inbox's look at one item (Book.isPeekSocket): the room, live, but opening it is not reading it.
  if (query("peek") === "1") url += "&peek=1";
  return url;
}
