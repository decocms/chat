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
  // SDK dictionaries can expose optional fields with an undefined value.
  // Property presence narrows the public union, but does not select the range.
  const suffix = "suffix" in range ? range.suffix : undefined;
  const offset = "offset" in range ? range.offset : undefined;
  const boundedLength = "length" in range ? range.length : undefined;
  const start =
    suffix !== undefined ? Math.max(0, object.size - suffix) : (offset ?? 0);
  const length =
    suffix !== undefined
      ? object.size - start
      : (boundedLength ?? object.size - start);
  headers.set(
    "content-range",
    `bytes ${start}-${start + length - 1}/${object.size}`,
  );
  headers.set("content-length", String(length));
  return new Response(object.body, { status: 206, headers });
}
