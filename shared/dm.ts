// Direct messages' pure rules, shared by the Worker (src/dm.ts) and its typed routes (src/api.ts), with no Worker types.

/** SQL for "f.a and f.b are connected" (a `friends f` row): both rows exist and neither was declined. A connection
 *  lets the two DM without sharing a room, so it takes both sides' yes. */
export const MUTUAL = `(f.declined_at IS NULL AND EXISTS (SELECT 1 FROM friends r WHERE r.a = f.b AND r.b = f.a AND r.declined_at IS NULL))`;

/** A DM room id: "dm" + 20 hex. Ordinary room ids are 12 hex, so they never start with "dm". */
export const isDmId = (id: string) => /^dm[0-9a-f]{20}$/.test(id);

/** The pair as stored on the room row: both emails, lower case, sorted, one per line (the same email twice for "Você"). */
export const pairKey = (a: string, b: string) =>
  [a.toLowerCase(), b.toLowerCase()].sort().join("\n");

/** Free email providers: their people share a domain but not a company, so they never count as colleagues. */
const PUBLIC_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.com.br",
  "outlook.com",
  "outlook.com.br",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.com.br",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
  "ig.com.br",
  "globo.com",
  "r7.com",
  "hey.com",
  "fastmail.com",
]);

/** The company domain of an email ("deco.cx" for gimenes@deco.cx), or null for a free provider or no domain. People
 *  with the same company domain can find each other in "Nova mensagem" and DM without a request (Gimenes #5006). */
export function corporateDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  const domain =
    at > 0
      ? email
          .slice(at + 1)
          .trim()
          .toLowerCase()
      : "";
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) || PUBLIC_DOMAINS.has(domain))
    return null;
  return domain;
}
