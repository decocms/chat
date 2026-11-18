import type { MeResult } from "../../../shared/schemas";

export type Contact = {
  email: string;
  name: string | null;
  avatar: number | null;
  rooms: readonly string[];
};

/** Who you can DM right away: people from your rooms, then connections you share no room with. */
export function contacts(me: MeResult): Contact[] {
  const seen = new Set([me.email]);
  const out: Contact[] = [];
  for (const person of me.people ?? [])
    if (!seen.has(person.email)) {
      seen.add(person.email);
      out.push(person);
    }
  for (const friend of me.friends)
    if (!seen.has(friend.email)) {
      seen.add(friend.email);
      out.push({ ...friend, rooms: [] });
    }
  return out;
}

const fold = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Contacts whose name or email has every word typed (accents ignored), ≤8; nothing typed = the first 8. */
export function matchContacts(list: readonly Contact[], query: string) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return list
    .filter((person) => {
      const hay = fold(`${person.name ?? ""} ${person.email}`);
      return words.every((word) => hay.includes(word));
    })
    .slice(0, 8);
}
