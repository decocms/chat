// Explicit eager test adapter: production owns cold acquisition outside synchronous parsing.
import { createHtmlTree } from "../svelte/features/rich-text/htmlTree";
import {
  richText as projectText,
  parseRichSource as parse,
} from "../svelte/features/rich-text/project";
import { createRichSession as session } from "../svelte/features/rich-text/session";
import type {
  RichContext,
  RichMode,
  RichPolicy,
} from "../svelte/features/rich-text/types";
export const richText = (
  source: string,
  mode: RichMode,
  context: RichContext,
) => projectText(source, mode, context, createHtmlTree);
export const parseRichSource = (
  source: string,
  mode: RichMode,
  policy?: RichPolicy,
) => parse(source, mode, policy, createHtmlTree);
export const createRichSession = () => session(createHtmlTree);
