<script lang="ts">
  import type { Room } from "../../../shared/room";
  import { onDestroy } from "svelte";
  import { createRichSession } from "./session";
  import type { RichActions, RichMode, RichPolicy } from "./types";
  import RichNodes from "./RichNodes.svelte";
  import { scopedRichFileIndex } from "./fileContext";
  let {
    text,
    mode = "markdown",
    room,
    actions,
    names,
    pageUrl,
    policy,
    fileLabel,
  }: {
    text: string;
    mode?: RichMode;
    room: Room;
    actions: RichActions;
    names?: Readonly<Record<string, string>>;
    pageUrl?: string;
    policy?: RichPolicy;
    fileLabel?: string;
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
</script>

{#if mode === "inline"}<span
    data-rich-content
    data-vb-native
    class="min-w-0 break-words font-sans leading-6 text-foreground"
    ><RichNodes {nodes} {actions} /></span
  >
{:else}<div
    data-rich-content
    data-vb-native
    class={mode === "human" || (nodes.length === 1 && nodes[0].kind === "text")
      ? "min-w-0 max-w-full overflow-x-auto whitespace-pre-wrap break-words font-sans leading-6 text-foreground"
      : // The block margins stay between blocks: a lone paragraph sits as close to the name above it as plain text does.
        "min-w-0 max-w-full overflow-x-auto break-words font-sans leading-6 text-foreground [&>:first-child]:mt-0 [&>:last-child]:mb-0"}
  >
    <RichNodes {nodes} {actions} />
  </div>{/if}
