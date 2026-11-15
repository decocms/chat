<script lang="ts">
  import { onDestroy, untrack, type Snippet } from "svelte";
  import { createRichPreparation, loadHtmlTree, type HtmlTreeLoader, type RichInput } from "./preparation";
  import type { ParsedRichSource, PreparedRichSource } from "./project";
  import RichPreparationStatus from "./RichPreparationStatus.svelte";
  let { source, input, current, children, loadHtml, createPreparation = createRichPreparation, lang }: {
    source: PreparedRichSource;
    input: RichInput;
    current(input: RichInput): boolean;
    children: Snippet<[ParsedRichSource]>;
    loadHtml?: HtmlTreeLoader;
    createPreparation?: typeof createRichPreparation;
    lang: string;
  } = $props();
  const owner = untrack(() => createPreparation({
    current: (captured) => current(captured),
    load: (signal) => (loadHtml ?? loadHtmlTree)(signal),
  }));
  onDestroy(() => owner.dispose());
  const prepared = $derived(owner.readPrepared(input, source));
</script>
{#if $prepared.phase === "ready"}{@render children($prepared.parsed)}
{:else}<RichPreparationStatus {lang} phase={$prepared.phase} retry={() => owner.retry()} />{/if}
