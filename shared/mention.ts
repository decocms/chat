// Who an @tag names, the same rule in the app (highlight, picker), the server (notifications, mention emails) and
// read_room. Names repeat (two "Rafael"s are fine); the @handle is each person's own (users.handle, unique, set in
// Settings › Profile), so the picker always inserts it and a picked mention reaches exactly that person.

/** Lowercase, accents stripped, only what an @tag can hold. */
export const foldHandle = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9._-]/g, "");

export type MentionPeople = {
  members: readonly string[];
  /** email → full name */
  names?: Readonly<Record<string, string>> | null;
  /** email → @handle */
  handles?: Readonly<Record<string, string>> | null;
};

const local = (email: string) => email.split("@")[0] ?? "";
/** Strongest first: the @handle, the email before the @, then the first name or the email's first token. */
const TIERS: ((email: string, people: MentionPeople) => string[])[] = [
  (email, people) => [people.handles?.[email] ?? ""],
  (email) => [local(email)],
  (email, people) => [
    (people.names?.[email] ?? "").split(/\s+/)[0] ?? "",
    local(email).split(/[._+-]/)[0] ?? "",
  ],
];

/** The member an @tag names, or null: no one, or two people at the same strength (two Rafaels typed as @rafael
 *  reach no one; the picker offers each by name and inserts their @handle). */
export function mentionWho(tag: string, people: MentionPeople): string | null {
  const key = foldHandle(tag);
  if (!key) return null;
  for (const tier of TIERS) {
    const hits = people.members.filter((email) =>
      tier(email, people).map(foldHandle).filter(Boolean).includes(key),
    );
    if (hits.length === 1) return hits[0]!;
    if (hits.length > 1) return null;
  }
  return null;
}

/** What a picked mention inserts: the person's @handle, else the shortest tag that reaches only them. */
export function mentionHandle(email: string, people: MentionPeople): string {
  const candidates = [
    people.handles?.[email] ?? "",
    ...TIERS.slice(1).flatMap((tier) => tier(email, people)),
  ]
    .map(foldHandle)
    .filter(Boolean);
  return (
    candidates.find((tag) => mentionWho(tag, people) === email) ??
    foldHandle(local(email))
  );
}
