import type { AppTarget } from "../apps/model";
import { Lexer } from "marked";
export type DocumentAppSize = "p" | "m" | "g";
export type DocumentAppMarker = AppTarget & {
  size: DocumentAppSize;
  occurrence: number;
  line: number;
  start: number;
  end: number;
  multiplicity: number;
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
  if (!source.includes("[[app:") || source.length > 100000) return result;
  let offset = 0;
  for (const token of Lexer.lex(source)) {
    const raw = token.raw;
    const found = token.type === "paragraph" ? marker.exec(raw.trim()) : null;
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
        line: source.slice(0, offset).split("\n").length - 1,
        start: offset,
        end: offset + raw.length,
        multiplicity: 0,
      });
    offset += raw.length;
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
    current.line !== expected.line ||
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
