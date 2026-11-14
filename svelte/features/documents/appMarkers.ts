import type { AppTarget } from "../apps/model";
import { markdownSource } from "../rich-text/markdownSource";
export type DocumentAppSize = "p" | "m" | "g";
export type DocumentAppMarker = AppTarget & {
  size: DocumentAppSize;
  occurrence: number;
  start: number;
  end: number;
  multiplicity: number;
  paragraphStart: number;
  paragraphEnd: number;
};
const marker = /^\[\[app:([\w-]+)\/([\w.-]+)(?:\|([pmg]))?\]\]$/i;
export const documentAppKey = (marker: DocumentAppMarker) =>
  JSON.stringify([
    marker.connection,
    marker.tool,
    marker.occurrence,
    marker.multiplicity,
  ]);
export function documentAppMarkers(source: string): DocumentAppMarker[] {
  const result: DocumentAppMarker[] = [];
  if (!/\[\[app:/i.test(source) || source.length > 100000) return result;
  for (const { token, span } of markdownSource(source).paragraphs) {
    const found = marker.exec(token.raw.trim());
    if (found)
      result.push({
        connection: found[1]!,
        tool: found[2]!,
        size:
          found[3]?.toLowerCase() === "p"
            ? "p"
            : found[3]?.toLowerCase() === "g"
              ? "g"
              : "m",
        occurrence: result.length,
        start: span.trimStart,
        end: span.trimEnd,
        paragraphStart: span.start,
        paragraphEnd: span.end,
        multiplicity: 0,
      });
  }
  const counts = new Map<string, number>();
  for (const entry of result) {
    const key = JSON.stringify([entry.connection, entry.tool]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const entry of result)
    entry.multiplicity =
      counts.get(JSON.stringify([entry.connection, entry.tool])) ?? 0;
  return result;
}
export function resizeDocumentApp(
  source: string,
  expected: DocumentAppMarker,
  size: DocumentAppSize,
): string | null {
  const current = documentAppMarkers(source)[expected.occurrence];
  if (
    !current ||
    current.paragraphStart !== expected.paragraphStart ||
    current.paragraphEnd !== expected.paragraphEnd ||
    current.start !== expected.start ||
    current.end !== expected.end ||
    current.connection !== expected.connection ||
    current.tool !== expected.tool ||
    current.size !== expected.size
  )
    return null;
  const raw = source.slice(current.start, current.end);
  const rewritten = raw.replace(/(?:\|[pmg])?\]\](?=\s*$)/i, `|${size}]]`);
  return source.slice(0, current.start) + rewritten + source.slice(current.end);
}
export function appendDocumentApp(
  source: string,
  target: AppTarget,
): string | null {
  const line = `[[app:${target.connection}/${target.tool}|m]]`;
  if (!marker.test(line)) return null;
  return `${source.replace(/\s*$/, "")}\n\n${line}\n`;
}

/** Reads the live owner on every dispatch, including before the next DOM flush. */
export function createDocumentAppAuthority(
  readSource: () => string,
  current: () => boolean,
) {
  let checkedSource: string | undefined,
    keys = new Set<string>();
  return (key: string) => {
    if (!current()) return false;
    const source = readSource();
    if (source !== checkedSource) {
      checkedSource = source;
      keys = new Set(documentAppMarkers(source).map(documentAppKey));
    }
    return keys.has(key);
  };
}
