import "server-only";
import * as z from "zod/mini";
import { Connection } from "../shared/schemas";
import { record } from "../shared/validation";
const nonempty = z.string().check(z.minLength(1));
export const ConnectionIdentity = z.extend(
  z.pick(Connection, { id: true, owner: true, scope: true }),
  { id: nonempty, owner: nonempty, book_id: nonempty },
);
const url = z.string().check(
  z.refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  }, "Invalid stored connection URL"),
);
export const ConnectionDeleteIdentity = z.omit(ConnectionIdentity, {
  scope: true,
});
const ConnectionRow = z
  .extend(ConnectionIdentity, {
    url,
    title: z.string(),
    enc: z.nullable(z.string()),
    iv: z.nullable(z.string()),
    tools: z.nullable(z.string()),
    ctx: z.nullable(z.string()),
    created_at: z.nullable(z.number()),
  })
  .check(
    z.refine(
      (value) =>
        (value.enc === null && value.iv === null) ||
        (typeof value.enc === "string" &&
          !!value.enc &&
          typeof value.iv === "string" &&
          !!value.iv),
      "Invalid stored credential pair",
    ),
  );
export type StoredConnection = z.infer<typeof ConnectionRow>;
/** Optional display/cache damage never invents identity or credential material. */
export function connectionRow(value: unknown): StoredConnection | null {
  if (!record(value)) return null;
  const parsedURL = url.safeParse(value.url);
  if (!parsedURL.success) return null;
  const parsed = ConnectionRow.safeParse({
    ...value,
    title:
      typeof value.title === "string"
        ? value.title
        : new URL(parsedURL.data).host,
    tools: typeof value.tools === "string" ? value.tools : null,
    ctx: typeof value.ctx === "string" ? value.ctx : null,
    created_at:
      typeof value.created_at === "number" && Number.isFinite(value.created_at)
        ? value.created_at
        : null,
  });
  return parsed.success ? parsed.data : null;
}
