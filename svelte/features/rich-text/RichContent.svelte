<script lang="ts">
  import type { Room } from "../../../shared/room";
  import { onDestroy } from "svelte";
  import { createRichSession } from "./session";
  import type { RichActions, RichMode, RichPolicy } from "./types";
  import RichNodes from "./RichNodes.svelte";
  import {
    createRichPreparation,
    loadHtmlTree,
    type HtmlTreeLoader,
  } from "./preparation";
  import RichPreparationStatus from "./RichPreparationStatus.svelte";
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
    lang?: string;
  } = $props();
  const idPrefix = $props.id();
  const fileIndex = scopedRichFileIndex();
  const session = createRichSession();
  onDestroy(() => session.dispose());
  const preparation = createRichPreparation({
    load: (signal) => (loadHtml ?? loadHtmlTree)(signal),
    current: (input) =>
      input.source === text &&
      input.mode === mode &&
      input.policy === policy &&
      input.scope === JSON.stringify([room.me, room.id]),
  });
  onDestroy(() => preparation.dispose());
  const prepared = $derived(
    preparation.read({
      source: text,
      mode,
      policy,
      scope: JSON.stringify([room.me, room.id]),
    }),
  );
  const nodes = $derived(
    $prepared.phase === "ready"
      ? session.project($prepared.parsed, {
          room,
          policy,
          names,
          pageUrl: pageUrl || location.href,
          idPrefix,
          fileLabel,
          fileIndex,
        })
      : [],
  );
</script>

{#if $prepared.phase !== "ready"}<RichPreparationStatus
    {lang}
    phase={$prepared.phase}
    retry={() => preparation.retry()}
  />
{:else if mode === "inline"}<span
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
