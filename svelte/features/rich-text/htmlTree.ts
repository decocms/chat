import {
  Parser,
  Token,
  html,
  defaultTreeAdapter,
  type DefaultTreeAdapterMap,
} from "parse5";
import type {
  MarkdownMetadata,
  MarkdownSink,
  TreeElement,
} from "./markdownTree";
/** Pinned parse5 8.1.1 adapter. One stack retains split tags, namespaces and HTML repair.
 * Token-event helpers are @internal exports, confined here; no serialization or protected methods.
 */
export function createHtmlTree(): MarkdownSink {
  let emitted = 0;
  let pending: { tag: string; metadata: MarkdownMetadata } | undefined;
  const metadata = new WeakMap<TreeElement, MarkdownMetadata>();
  const adapter = {
    ...defaultTreeAdapter,
    createElement(
      ...args: Parameters<typeof defaultTreeAdapter.createElement>
    ) {
      if (++emitted > 4096) throw new Error("Rich parser node limit");
      const element = defaultTreeAdapter.createElement(...args);
      if (pending?.tag === args[0]) metadata.set(element, pending.metadata);
      return element;
    },
  };
  const parser = Parser.getFragmentParser<DefaultTreeAdapterMap>(null, {
    treeAdapter: adapter,
    scriptingEnabled: false,
  });
  const flush = () => parser.tokenizer.flushCurrentCharacterToken();
  function tag(
    name: string,
    start: boolean,
    attrs: Token.Attribute[] = [],
    meta?: MarkdownMetadata,
  ) {
    flush();
    pending = meta ? { tag: name, metadata: meta } : undefined;
    const token: Token.TagToken = {
      type: start ? Token.TokenType.START_TAG : Token.TokenType.END_TAG,
      tagName: name,
      tagID: html.getTagID(name),
      selfClosing: false,
      ackSelfClosing: false,
      attrs,
      location: null,
    };
    if (start) parser.onStartTag(token);
    else parser.onEndTag(token);
    pending = undefined;
  }
  function text(value: string) {
    flush();
    for (const part of value.split(/(\s+)/)) {
      if (!part) continue;
      const whitespace = /^\s+$/.test(part);
      const token: Token.CharacterToken = {
        type: whitespace
          ? Token.TokenType.WHITESPACE_CHARACTER
          : Token.TokenType.CHARACTER,
        chars: part,
        location: null,
      };
      if (whitespace) parser.onWhitespaceCharacter(token);
      else parser.onCharacter(token);
    }
  }
  return {
    tag,
    text,
    raw(value) {
      parser.tokenizer.write(value, false);
      flush();
    },
    finish() {
      parser.tokenizer.write("", true);
      return { fragment: parser.getFragment(), metadata };
    },
  };
}
