import type { AppTarget } from '../apps/model';
export type DocumentAppSize = 'p' | 'm' | 'g';
export type DocumentAppMarker = AppTarget & { size: DocumentAppSize; occurrence: number; line: number };
const marker = /^\[\[app:([\w-]+)\/([\w.-]+)(?:\|([pmg]))?\]\]$/i;
export function documentAppMarkers(source: string): DocumentAppMarker[] {
  const result: DocumentAppMarker[] = [];
  source.split('\n').forEach((line, index) => {
    const found = marker.exec(line.trim());
    if (found) result.push({ connection: found[1]!, tool: found[2]!, size: found[3]?.toLowerCase() === 'p' ? 'p' : found[3]?.toLowerCase() === 'g' ? 'g' : 'm', occurrence: result.length, line: index });
  });
  return result;
}
export function resizeDocumentApp(source: string, expected: DocumentAppMarker, size: DocumentAppSize): string | null {
  const current = documentAppMarkers(source)[expected.occurrence];
  if (!current || current.line !== expected.line || current.connection !== expected.connection || current.tool !== expected.tool || current.size !== expected.size) return null;
  const lines = source.split('\n');
  lines[current.line] = lines[current.line]!.trim().replace(/(?:\|[pmg])?\]\]$/i, `|${size}]]`);
  return lines.join('\n');
}
export function appendDocumentApp(source: string, target: AppTarget): string | null {
  const line = `[[app:${target.connection}/${target.tool}|m]]`;
  if (!marker.test(line)) return null;
  return `${source.replace(/\s*$/, '')}\n\n${line}\n`;
}
