import { Lexer, Tokenizer } from "marked";
import { markdownSourceOffsets } from "./sourceOffsets";
export type MarkdownSourceSpan = {
  start: number;
  end: number;
  trimStart: number;
  trimEnd: number;
};
type SourceToken = {
  type: string;
  raw: string;
  text?: unknown;
  tokens?: unknown;
  items?: unknown;
  loose?: unknown;
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
function tokenArray(value: unknown): readonly SourceToken[] | null {
  return Array.isArray(value) &&
    value.every(
      (item: unknown): item is SourceToken =>
        record(item) &&
        typeof item.type === "string" &&
        typeof item.raw === "string",
    )
    ? value
    : null;
}
function unknownArray(value: unknown): readonly unknown[] | null {
  return Array.isArray(value) ? value : null;
}
type SourceView = { text: string; offsets: readonly number[] };
/** A container tokenizer removes only line prefixes. Map each known child line
 * to the suffix of its corresponding source line, never by a text search across
 * sibling tokens. Verify every token's raw span before granting source ownership. */
function containerView(parent: SourceView, text: string): SourceView | null {
  const lines = text.split("\n"),
    rawLines = parent.text.split("\n");
  if (lines.length > rawLines.length) return null;
  const offsets: number[] = [];
  let parentAt = 0;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!,
      raw = rawLines[index]!;
    let prefix = 0,
      suffix = line;
    if (!raw.endsWith(suffix)) {
      suffix = line.trimStart();
      prefix = line.length - suffix.length;
      if (!raw.endsWith(suffix)) return null;
    }
    const start = parentAt + raw.length - suffix.length;
    for (let at = 0; at < line.length; at++)
      offsets.push(parent.offsets[start + Math.max(0, at - prefix)]!);
    if (index < lines.length - 1)
      offsets.push(parent.offsets[parentAt + raw.length]!);
    else offsets.push(parent.offsets[parentAt + raw.length]!);
    parentAt += raw.length + 1;
  }
  return offsets.length === text.length + 1 ? { text, offsets } : null;
}
export function markdownSource(source: string) {
  const normalized = markdownSourceOffsets(source),
    remaining = new WeakMap<object, number>();
  // Public tokenizer hooks retain the remaining input length. This includes
  // skipped link definitions; summing emitted token.raw lengths would not.
  class SourceTokenizer extends Tokenizer {
    override paragraph(source: string) {
      const token = super.paragraph(source);
      if (token) remaining.set(token, source.length);
      return token;
    }
    override text(source: string) {
      const token = super.text(source);
      if (token) remaining.set(token, source.length);
      return token;
    }
    override blockquote(source: string) {
      const token = super.blockquote(source);
      if (token) remaining.set(token, source.length);
      return token;
    }
    override list(source: string) {
      const token = super.list(source);
      if (token) remaining.set(token, source.length);
      return token;
    }
  }
  const tokens = new Lexer({
    gfm: true,
    breaks: true,
    tokenizer: new SourceTokenizer(),
  }).lex(normalized.source);
  const spans = new WeakMap<object, MarkdownSourceSpan>(),
    paragraphs: { token: SourceToken; span: MarkdownSourceSpan }[] = [];
  let visited = 0;
  function walk(
    values: readonly SourceToken[],
    view: SourceView,
    loose = false,
    depth = 0,
  ) {
    if (depth > 48) return;
    for (const token of values) {
      if (++visited > 8192) return;
      const length = remaining.get(token);
      if (length === undefined) continue;
      const at = view.text.length - length,
        end = at + token.raw.length;
      if (at < 0 || view.text.slice(at, end) !== token.raw) continue;
      const offsets = view.offsets.slice(at, end + 1),
        rawView = { text: token.raw, offsets };
      const leading = token.raw.length - token.raw.trimStart().length,
        trailing = token.raw.trimEnd().length;
      const span = {
        start: offsets[0]!,
        end: offsets.at(-1)!,
        trimStart: offsets[leading]!,
        trimEnd: offsets[trailing]!,
      };
      spans.set(token, span);
      if (
        token.type === "paragraph" ||
        (loose && token.type === "text" && tokenArray(token.tokens))
      )
        paragraphs.push({ token, span });
      const nested = tokenArray(token.tokens);
      if (
        token.type === "blockquote" &&
        typeof token.text === "string" &&
        nested
      ) {
        const child = containerView(rawView, token.text);
        if (child) walk(nested, child, false, depth + 1);
      } else if (token.type === "list") {
        const items = unknownArray(token.items);
        if (!items) continue;
        let itemAt = 0;
        for (const item of items) {
          if (
            !record(item) ||
            typeof item.raw !== "string" ||
            typeof item.text !== "string"
          )
            break;
          const children = tokenArray(item.tokens);
          if (!children) break;
          const itemEnd = itemAt + item.raw.length;
          if (token.raw.slice(itemAt, itemEnd) !== item.raw) break;
          const child = containerView(
            { text: item.raw, offsets: offsets.slice(itemAt, itemEnd + 1) },
            item.text,
          );
          if (child) walk(children, child, token.loose === true, depth + 1);
          itemAt = itemEnd;
        }
      }
    }
  }
  walk(tokens, { text: normalized.source, offsets: normalized.offsets });
  return { tokens, spans, paragraphs };
}
