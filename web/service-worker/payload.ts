import * as z from "zod/mini";
export const PushPayload = z.object({
  title: z.optional(z.string()),
  body: z.optional(z.string()),
  tag: z.optional(z.string()),
  url: z.optional(z.string()),
});
export function notificationTarget(value: unknown, origin: string) {
  let target: URL;
  try {
    target = new URL(typeof value === "string" ? value : "/", origin);
  } catch {
    target = new URL("/", origin);
  }
  if (
    target.origin !== origin ||
    !/^\/(?:(?:archived|b\/[a-z0-9]+)\/?)?$/.test(target.pathname)
  )
    target = new URL("/", origin);
  return target.href;
}
