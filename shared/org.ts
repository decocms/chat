// Your company email domain: people with the same one see each other in "Nova mensagem", DM without a request
// (src/dm.ts, src/services.ts) and can open a room to the domain (src/orgRooms.ts). Sign-in accepts only an email that
// deco Studio verified (src/auth.ts), so the domain says where a person works.
// A free or public email provider (gmail.com, outlook.com, uol.com.br …) is not a company: its people get nothing.
// Only the Worker imports this file: the provider list is too large for the browser bundle. The browser reads your
// domain from the server (`domain` in /api/books/:id/org and /api/org/rooms).
import { FREE_EMAIL_DOMAINS } from "./free-email-domains";

/** Providers that the copied list (shared/free-email-domains.ts) does not have. Add one here, not in that file. */
const MORE_FREE_DOMAINS = ["globo.com", "r7.com", "hey.com"];

let free: Set<string> | undefined;
/** True when `domain` is a free or public email provider. */
export const isFreeEmailDomain = (domain: string) =>
  (free ??= new Set([
    ...FREE_EMAIL_DOMAINS.split("\n"),
    ...MORE_FREE_DOMAINS,
  ])).has(domain.toLowerCase());

/** The company domain of an email ("deco.cx" for gimenes@deco.cx): the exact text after "@", in lower case. Null for
 *  a free provider or a malformed email. A subdomain is a different domain: `x@evil.acme.com` is not `y@acme.com`. */
export function corporateDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  const domain =
    at > 0
      ? email
          .slice(at + 1)
          .trim()
          .toLowerCase()
      : "";
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) || isFreeEmailDomain(domain))
    return null;
  return domain;
}
