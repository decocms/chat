import { ConnectionIdentityResult } from "../shared/schemas";
import type { StoredConnection } from "./connectionRows";

export type ConnectionIdentityFailure = {
  error: string;
  status: 400 | 403 | 404 | 429 | 502;
};
/** Request-bound effects. No token decryption, OAuth refresh or remote MCP call is needed. */
export interface ConnectionIdentityPorts {
  email: string;
  member(room: string): Promise<boolean>;
  connection(room: string, cid: string): Promise<StoredConnection | null>;
  allowed(): Promise<boolean>;
  signedIn(url: string): Promise<boolean>;
  sign(room: string, url: string): Promise<string>;
  track(room: string, url: string): void;
}
const missing: ConnectionIdentityFailure = { error: "conexão não encontrada", status: 404 };
const forbidden: ConnectionIdentityFailure = { error: "forbidden", status: 403 };
const sameAuthority = (a: StoredConnection, b: StoredConnection) =>
  a.id === b.id && a.book_id === b.book_id && a.owner === b.owner && a.scope === b.scope &&
  a.url === b.url && a.enc === b.enc && a.iv === b.iv;

/** Sign only the current authorized stored destination; repeat authority reads after asynchronous signing. */
export async function connectionIdentity(
  room: string,
  cid: string,
  ports: ConnectionIdentityPorts,
): Promise<ConnectionIdentityResult | ConnectionIdentityFailure> {
  const read = async (): Promise<StoredConnection | ConnectionIdentityFailure> => {
    if (!(await ports.member(room))) return forbidden;
    const row = await ports.connection(room, cid);
    if (!(await ports.member(room))) return forbidden;
    if (!row || row.id !== cid || row.book_id !== room || (row.scope === "me" && row.owner !== ports.email)) return missing;
    return row;
  };
  try {
    const first = await read();
    if ("error" in first) return first;
    if (!(await ports.allowed())) return { error: "rate limited", status: 429 };
    const inspect = async (): Promise<ConnectionIdentityResult | ConnectionIdentityFailure | null> => {
      const current = await read();
      if ("error" in current) return current;
      if (!sameAuthority(first, current)) return missing;
      // Even an expired grant retains the legacy sign-in route: never export its credentials.
      const signedIn = current.enc && current.iv ? false : await ports.signedIn(current.url);
      const final = await read();
      if ("error" in final) return final;
      if (!sameAuthority(current, final)) return missing;
      if (final.enc && final.iv) return { direct: false, why: "token" };
      return signedIn ? { direct: false, why: "signed_in" } : null;
    };
    const before = await inspect();
    if (before) return before;
    const destination = new URL(first.url);
    if (destination.username || destination.password) return { error: "invalid connection URL", status: 400 };
    const identity = await ports.sign(room, first.url);
    const after = await inspect();
    if (after) return after;
    const result = ConnectionIdentityResult.parse({ direct: true, url: first.url, identity, expires_in: 300 });
    ports.track(room, first.url);
    return result;
  } catch {
    return { error: "connection identity unavailable", status: 502 };
  }
}
