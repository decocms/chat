<script lang="ts">
  import type { Room } from "../../../shared/room";
  import { onDestroy } from "svelte";
  import { createRichSession } from "./session";
  import type { RichActions, RichMode, RichPolicy, RichNode, RichContext } from "./types";
  import RichNodes from "./RichNodes.svelte";
  import {
    type createRichPreparation,
    type RichInput,
    type HtmlTreeLoader,
  } from "./preparation";
  import HtmlRichSource from "./HtmlRichSource.svelte";
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
    loadHtml,
    createHtmlPreparation,
    lang = "pt",
  }: {
    text: string;
    mode?: RichMode;
    room: Room;
    actions: RichActions;
    names?: Readonly<Record<string, string>>;
    pageUrl?: string;
    policy?: RichPolicy;
    fileLabel?: string;
    loadHtml?: HtmlTreeLoader;
    createHtmlPreparation?: typeof createRichPreparation;
    lang?: string;
  } = $props();
  const idPrefix = $props.id();
  const fileIndex = scopedRichFileIndex();
  const session = createRichSession();
  onDestroy(() => session.dispose());
  const display = $derived(session.display(text, mode, policy));
  const context: RichContext = $derived({
    room, policy, names, pageUrl: pageUrl || location.href, idPrefix, fileLabel, fileIndex,
  });
  const nodes = $derived(display.kind === "ready" ? session.project(display.parsed, context) : []);
  const htmlCurrent = (input: RichInput) =>
    input.source === text && input.mode === mode && input.policy === policy && input.scope === JSON.stringify([room.me, room.id]);
</script>

{#snippet body(nodes: RichNode[])}
{#if mode === "inline"}<span
    data-rich-content
    data-vb-native
    class="tw:min-w-0 tw:break-words tw:font-sans tw:leading-6 tw:text-foreground"
    ><RichNodes {nodes} {actions} /></span
  >
{:else}<div
    data-rich-content
    data-vb-native
    class={mode === "human" || (nodes.length === 1 && nodes[0].kind === "text")
      ? "tw:min-w-0 tw:max-w-full tw:overflow-x-auto tw:whitespace-pre-wrap tw:break-words tw:font-sans tw:leading-6 tw:text-foreground"
      : "tw:min-w-0 tw:max-w-full tw:overflow-x-auto tw:break-words tw:font-sans tw:leading-6 tw:text-foreground"}
  >
    <RichNodes {nodes} {actions} />
  </div>{/if}

{/snippet}
{#if display.kind === "ready"}{@render body(nodes)}
{:else}<HtmlRichSource source={display.prepared} input={{ source: text, mode, policy, scope: JSON.stringify([room.me, room.id]) }} current={htmlCurrent} {loadHtml} createPreparation={createHtmlPreparation} {lang}>
  {#snippet children(parsed)}{@render body(session.project(parsed, context))}{/snippet}
</HtmlRichSource>{/if}
