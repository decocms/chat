import { Lexer, type Tokens } from "marked";
import { markdownSource } from "./markdownSource";
import { decodeHTML } from "entities";
import { HTML_NS } from "./allowlist";
export type TreeAttribute = { name: string; value: string; prefix?: string };
export type TreeText = { nodeName: "#text"; value: string };
export type TreeElement = {
  nodeName: string;
  tagName: string;
  namespaceURI: string;
  attrs: TreeAttribute[];
  childNodes: TreeNode[];
};
export type TreeComment = { nodeName: "#comment"; data: string };
export type TreeDocumentType = {
  nodeName: "#documentType";
  name: string;
  publicId: string;
  systemId: string;
};
export type TreeNode =
  TreeFragment | TreeElement | TreeText | TreeComment | TreeDocumentType;
export type TreeFragment = {
  nodeName: "#document-fragment";
  childNodes: TreeNode[];
};
export type MarkdownMetadata = {
  task?: boolean;
  language?: string;
  sourceStart?: number;
  sourceEnd?: number;
};
export type MarkdownTree = {
  fragment: TreeFragment;
  metadata: WeakMap<TreeElement, MarkdownMetadata>;
};
export type MarkdownSink = {
  tag(
    name: string,
    start: boolean,
    attrs?: TreeAttribute[],
    meta?: MarkdownMetadata,
  ): void;
  text(value: string): void;
  raw(value: string): void;
  finish(): MarkdownTree;
};
export type HtmlTreeFactory = () => MarkdownSink;
export type MarkdownTokens = ReturnType<typeof prepareMarkdown>;
/** Lex once, retaining token identities used by verified document source spans. */
export function prepareMarkdown(source: string, documentImages = false) {
  const parsed = documentImages
    ? markdownSource(source)
    : {
        tokens: Lexer.lex(source, { gfm: true, breaks: true }),
        spans: new WeakMap<object, { start: number; end: number }>(),
      };
  function rawHtml(values: Tokens.Generic[], depth = 0): boolean {
    if (depth > 48) throw Error("Rich token depth limit");
    let found = false;
    for (const value of values) {
      const token = value as KnownToken;
      if (token.type === "html") found = true;
      if ("tokens" in token && token.tokens)
        found = rawHtml(token.tokens, depth + 1) || found;
      if (token.type === "list")
        for (const item of token.items)
          found = rawHtml(item.tokens, depth + 1) || found;
      if (token.type === "table") {
        for (const cell of token.header)
          found = rawHtml(cell.tokens, depth + 1) || found;
        for (const row of token.rows)
          for (const cell of row)
            found = rawHtml(cell.tokens, depth + 1) || found;
      }
    }
    return found;
  }
  return { ...parsed, html: rawHtml(parsed.tokens), documentImages };
}
type KnownToken =
  | Tokens.Space
  | Tokens.Code
  | Tokens.Heading
  | Tokens.Table
  | Tokens.Hr
  | Tokens.Blockquote
  | Tokens.List
  | Tokens.ListItem
  | Tokens.Paragraph
  | Tokens.HTML
  | Tokens.Text
  | Tokens.Def
  | Tokens.Escape
  | Tokens.Tag
  | Tokens.Image
  | Tokens.Link
  | Tokens.Strong
  | Tokens.Em
  | Tokens.Codespan
  | Tokens.Br
  | Tokens.Del;

/** Semantic Markdown creates balanced known HTML elements, with no DOM or HTML parsing. */
function semanticSink(): MarkdownSink {
  const fragment: TreeFragment = {
      nodeName: "#document-fragment",
      childNodes: [],
    },
    metadata = new WeakMap<TreeElement, MarkdownMetadata>(),
    stack: (TreeFragment | TreeElement)[] = [fragment];
  let emitted = 0;
  return {
    tag(name, start, attrs = [], meta) {
      if (!start) {
        const top = stack.at(-1)!;
        if (stack.length === 1 || !("tagName" in top) || top.tagName !== name)
          throw Error("Unbalanced semantic Markdown");
        stack.pop();
        return;
      }
      if (++emitted > 4096) throw Error("Rich parser node limit");
      const node: TreeElement = {
        nodeName: name,
        tagName: name,
        namespaceURI: HTML_NS,
        attrs,
        childNodes: [],
      };
      if (meta) metadata.set(node, meta);
      stack.at(-1)!.childNodes.push(node);
      if (!["br", "hr", "img"].includes(name)) stack.push(node);
    },
    text(value) {
      if (!value) return;
      const children = stack.at(-1)!.childNodes,
        last = children.at(-1);
      if (last && "value" in last) last.value += value;
      else children.push({ nodeName: "#text", value });
    },
    raw() {
      throw Error("Raw HTML requires prepared parser");
    },
    finish() {
      if (stack.length !== 1) throw Error("Unbalanced semantic Markdown");
      return { fragment, metadata };
    },
  };
}
/** Full raw-HTML parser is explicit and prepared before this synchronous call. */
export function markdownTree(
  parsedSource: MarkdownTokens,
  full?: HtmlTreeFactory,
): MarkdownTree {
  if (parsedSource.html && !full) throw Error("HTML parser was not prepared");
  const sink = parsedSource.html ? full!() : semanticSink();
  const { documentImages } = parsedSource;
  const tag: MarkdownSink["tag"] = (...args) => sink.tag(...args);
  const text = (value: string) => sink.text(value);
  let depth = 0;
  const attrs = (values: Record<string, string | number | undefined>) =>
    Object.entries(values)
      .filter(
        (entry): entry is [string, string | number] => entry[1] !== undefined,
      )
      .map(([name, value]) => ({ name, value: String(value) }));
  const wrap = (
    name: string,
    children: Tokens.Generic[],
    attributes: TreeAttribute[] = [],
    meta?: MarkdownMetadata,
  ) => {
    tag(name, true, attributes, meta);
    tokens(children);
    tag(name, false);
  };
  function tokens(input: Tokens.Generic[], loose = false) {
    if (++depth > 48) throw new Error("Rich token depth limit");
    for (const raw of input) {
      const token = raw as KnownToken;
      const span = parsedSource.spans.get(raw);
      const sourceSpan = span
        ? { sourceStart: span.start, sourceEnd: span.end }
        : undefined;
      switch (token.type) {
        case "space":
        case "def":
          break;
        case "html":
          sink.raw(token.text);
          break;
        case "heading":
          wrap(`h${token.depth}`, token.tokens);
          break;
        case "paragraph":
          wrap("p", token.tokens, [], sourceSpan);
          break;
        case "blockquote":
          wrap("blockquote", token.tokens);
          break;
        case "strong":
        case "em":
        case "del":
          wrap(token.type, token.tokens);
          break;
        case "escape":
          text(decodeHTML(token.text));
          break;
        case "text":
          if ("tokens" in token && token.tokens) {
            if (loose) wrap("p", token.tokens, [], sourceSpan);
            else tokens(token.tokens);
          } else text(decodeHTML(token.text));
          break;
        case "codespan":
          tag("code", true);
          text(decodeHTML(token.text));
          tag("code", false);
          break;
        case "code":
          tag("pre", true);
          tag("code", true, [], { language: token.lang?.split(/\s+/)[0] });
          text(token.text + "\n");
          tag("code", false);
          tag("pre", false);
          break;
        case "br":
          tag("br", true);
          break;
        case "hr":
          tag("hr", true);
          break;
        case "image":
          if (documentImages)
            tag(
              "img",
              true,
              attrs({
                src: decodeHTML(token.href),
                alt: decodeHTML(token.text),
                title: token.title ? decodeHTML(token.title) : undefined,
              }),
            );
          break; // Chat retains its existing no-image policy.
        case "link":
          wrap(
            "a",
            token.tokens,
            attrs({
              href: decodeHTML(token.href),
              title: token.title ? decodeHTML(token.title) : undefined,
            }),
          );
          break;
        case "list":
          tag(
            token.ordered ? "ol" : "ul",
            true,
            token.ordered && token.start !== 1
              ? attrs({ start: token.start })
              : [],
          );
          for (const item of token.items) {
            tag(
              "li",
              true,
              [],
              item.task ? { task: !!item.checked } : undefined,
            );
            tokens(item.tokens, token.loose);
            tag("li", false);
          }
          tag(token.ordered ? "ol" : "ul", false);
          break;
        case "list_item":
          tokens(token.tokens, token.loose);
          break;
        case "table":
          tag("table", true);
          tag("thead", true);
          tag("tr", true);
          token.header.forEach((cell, i) =>
            wrap(
              "th",
              cell.tokens,
              attrs({ align: token.align[i] || undefined }),
            ),
          );
          tag("tr", false);
          tag("thead", false);
          if (token.rows.length) {
            tag("tbody", true);
            for (const row of token.rows) {
              tag("tr", true);
              row.forEach((cell, i) =>
                wrap(
                  "td",
                  cell.tokens,
                  attrs({ align: token.align[i] || undefined }),
                ),
              );
              tag("tr", false);
            }
            tag("tbody", false);
          }
          tag("table", false);
          break;
        default:
          text(raw.raw);
      }
    }
    depth--;
  }
  tokens(parsedSource.tokens);
  return sink.finish();
}
