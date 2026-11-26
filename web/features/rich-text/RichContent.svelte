<script lang="ts">
  import type { Room } from "../../../shared/room";
  import { onDestroy } from "svelte";
  import { createRichSession } from "./session";
  import type { RichActions, RichMode, RichPolicy } from "./types";
  import RichNodes from "./RichNodes.svelte";
  import { scopedRichFileIndex } from "./fileContext";
  import {
    createApplicationCopy,
    resolveApplicationLanguage,
  } from "../application/copy";
  let {
    text,
    mode = "markdown",
    room,
    actions,
    names,
    pageUrl,
    policy,
    fileLabel,
    t = createApplicationCopy(
      resolveApplicationLanguage(document.cookie, navigator.language),
    ),
  }: {
    text: string;
    mode?: RichMode;
    room: Room;
    actions: RichActions;
    names?: Readonly<Record<string, string>>;
    pageUrl?: string;
    policy?: RichPolicy;
    fileLabel?: string;
    /** The app's copy, for the chips of links to this app. */
    t?: (text: string) => string;
  } = $props();
  const idPrefix = $props.id();
  const fileIndex = scopedRichFileIndex();
  const session = createRichSession();
  onDestroy(() => session.dispose());
  const nodes = $derived(
    session.render(text, mode, {
      room,
      policy,
      names,
      pageUrl: pageUrl || location.href,
      idPrefix,
      fileLabel,
      fileIndex,
    }),
  );
  // One flow of text and inline nodes (the text's last line is the box's last line), or blocks (paragraphs, lists).
  // A message puts its "seen" faces at the end of the last line (chat/Message.svelte).
  const flowing = $derived(
    mode === "human" || (nodes.length === 1 && nodes[0].kind === "text"),
  );
</script>

{#if mode === "inline"}<span
    data-rich-content
    class="min-w-0 break-words font-sans leading-6 text-foreground"
    ><RichNodes {nodes} {actions} {room} {t} /></span
  >
{:else}<div
    data-rich-content
    data-rich-flow={flowing ? "inline" : "block"}
    class={flowing
      ? "min-w-0 max-w-full overflow-x-auto whitespace-pre-wrap break-words font-sans leading-6 text-foreground [&>blockquote:first-child]:mt-1 [&>blockquote:last-child]:mb-0"
      : // The block margins stay between blocks: a lone paragraph sits as close to the name above it as plain text does.
        "min-w-0 max-w-full overflow-x-auto break-words font-sans leading-6 text-foreground [&>:first-child]:mt-0 [&>:last-child]:mb-0"}
  >
    <RichNodes {nodes} {actions} {room} {t} />
  </div>{/if}
