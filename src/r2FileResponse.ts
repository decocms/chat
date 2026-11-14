import "server-only";

/** Only the fields consumed from the public R2 SDK result. R2, rather than
 * this helper, parses the incoming Range header and returns the selected body. */
type FileObject =
  | Pick<R2Object, "range" | "size">
  | Pick<R2ObjectBody, "range" | "size" | "body">;

/** Preserve full/bodyless responses and Safari's byte-range 206 behavior while
 * narrowing the SDK's real offset/length/suffix union without an assertion. */
export function r2FileResponse(
  object: FileObject,
  ranged: boolean,
  headers: Headers,
): Response {
  const range = object.range;
  if (!ranged || !range || !("body" in object))
    return new Response("body" in object ? object.body : null, { headers });
  const start =
    "suffix" in range
      ? Math.max(0, object.size - range.suffix)
      : (range.offset ?? 0);
  const length =
    "suffix" in range
      ? object.size - start
      : (range.length ?? object.size - start);
  headers.set(
    "content-range",
    `bytes ${start}-${start + length - 1}/${object.size}`,
  );
  headers.set("content-length", String(length));
  return new Response(object.body, { status: 206, headers });
}
