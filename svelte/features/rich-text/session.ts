import {
  prepareRichSource,
  parsePreparedRichSource,
  projectRichSource,
  type PreparedRichSource,
} from "./project";
import { knownFileFingerprint } from "./links";
import type { HtmlTreeFactory } from "./markdownTree";
import type { ParsedRichSource } from "./project";
import type { RichContext, RichMode, RichNode } from "./types";
/** Values used by mention recognition, immutable file targets/version ordering and local IDs.
 * Presence/receipts/message text do not change this key. No global/account text cache exists. */
function contextKey(context: RichContext, files: string): string {
  return JSON.stringify([
    context.policy,
    context.room.id,
    context.room.me,
    context.pageUrl,
    context.idPrefix,
    context.fileLabel,
    context.room.members.map((email) => [
      email,
      context.room.names?.[email],
      context.names?.[email],
    ]),
    files,
  ]);
}
export type RichHtmlDisplay = {
  kind: "html";
  source: string;
  mode: RichMode;
  policy?: RichContext["policy"];
  prepared: PreparedRichSource;
};
export type ReadyRichDisplay = { kind: "ready"; parsed: ParsedRichSource };
export type RichDisplay = ReadyRichDisplay | RichHtmlDisplay;
/** One syntax result and one projection per mounted content component; no async owner on normal content. */
export function createRichSession(full?: HtmlTreeFactory) {
  let active = true,
    previousText: string | undefined,
    previousMode: RichMode | undefined,
    previousPolicy: RichContext["policy"],
    previousContext: string | undefined;
  let previousParts: readonly unknown[] | undefined;
  let display: RichDisplay | undefined,
    nodes: RichNode[] | undefined,
    projected: ParsedRichSource | undefined;
  return {
    display(
      text: string,
      mode: RichMode,
      policy?: RichContext["policy"],
    ): RichDisplay {
      if (!active)
        return { kind: "ready", parsed: { text, mode, literal: true } };
      if (
        !display ||
        text !== previousText ||
        mode !== previousMode ||
        policy !== previousPolicy
      ) {
        // A pending HTML source must not retain the previous source projection.
        projected = undefined;
        nodes = undefined;
        previousContext = undefined;
        previousParts = undefined;
        const prepared = prepareRichSource(text, mode, policy);
        display =
          prepared.tokens?.html && !full
            ? { kind: "html", source: text, mode, policy, prepared }
            : {
                kind: "ready",
                parsed: parsePreparedRichSource(prepared, full),
              };
        previousText = text;
        previousMode = mode;
        previousPolicy = policy;
      }
      return display;
    },
    adoptHtml(
      request: RichHtmlDisplay,
      parsed: ParsedRichSource,
    ): ReadyRichDisplay | undefined {
      if (!active || display !== request) return undefined;
      display = { kind: "ready", parsed };
      return display;
    },
    render(text: string, mode: RichMode, context: RichContext): RichNode[] {
      const source = this.display(text, mode, context.policy);
      if (source.kind === "html") throw Error("HTML parser was not prepared");
      return this.project(source.parsed, context);
    },
    project(value: ParsedRichSource, context: RichContext): RichNode[] {
      if (!active) return [{ kind: "text", text: value.text }];
      const changed = projected !== value;
      projected = value;
      const parts = [
        // Validate the current scope even if all incoming props stayed identical.
        context.fileIndex?.read(context.room)?.fingerprint,
        context.fileIndex,
        context.policy,
        context.room.id,
        context.room.me,
        context.room.members,
        context.room.names,
        context.names,
        context.room.files,
        context.room.messages,
        context.room.origins,
        context.pageUrl,
        context.idPrefix,
        context.fileLabel,
      ];
      // Room reducer snapshots retain unchanged arrays/maps: receipt/presence updates avoid even fingerprint scans.
      const key =
        previousParts &&
        parts.every((part, index) => part === previousParts![index])
          ? previousContext!
          : contextKey(context, knownFileFingerprint(context));
      previousParts = parts;
      if (changed || !nodes || key !== previousContext) {
        nodes = projectRichSource(value, context);
        previousContext = key;
      }
      return nodes;
    },
    dispose() {
      active = false;
      previousText = undefined;
      previousMode = undefined;
      previousPolicy = undefined;
      previousContext = undefined;
      previousParts = undefined;
      display = undefined;
      projected = undefined;
      nodes = undefined;
    },
  };
}
