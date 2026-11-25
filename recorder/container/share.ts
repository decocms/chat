// Who a recording is shared with in Grain: the people who were in the call and have a Grain account. Pure: plain
// Node and the tests load it.
export type GrainUser = { id: string; email: string | null };

/** The Grain users whose email is one of `emails` (any case), each one time. */
export function shareWith(users: readonly GrainUser[], emails: readonly string[]): string[] {
  const wanted = new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean));
  return [...new Set(users.filter((user) => user.email && wanted.has(user.email.toLowerCase())).map((user) => user.id))];
}
