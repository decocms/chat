<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import {
    createRichPreparation,
    loadHtmlTree,
    type HtmlTreeLoader,
    type RichInput,
  } from "./preparation";
  import type { ParsedRichSource } from "./project";
  import type { RichHtmlDisplay } from "./session";
  import RichPreparationStatus from "./RichPreparationStatus.svelte";
  let {
    display,
    scope,
    current,
    adopted,
    loadHtml,
    createPreparation = createRichPreparation,
    lang,
  }: {
    display: RichHtmlDisplay;
    scope: string;
    current(input: RichInput): boolean;
    adopted(
      request: RichHtmlDisplay,
      parsed: ParsedRichSource,
      input: RichInput,
    ): void;
    loadHtml?: HtmlTreeLoader;
    createPreparation?: typeof createRichPreparation;
    lang: string;
  } = $props();
  const owner = untrack(() =>
    createPreparation({
      current: (captured) => current(captured),
      load: (signal) => (loadHtml ?? loadHtmlTree)(signal),
    }),
  );
  onDestroy(() => owner.dispose());
  const pending = $derived.by(() => {
    const request = display,
      input = {
        source: request.source,
        mode: request.mode,
        policy: request.policy,
        scope,
      };
    return {
      request,
      input,
      store: owner.readPrepared(input, request.prepared),
    };
  });
  const prepared = $derived(pending.store);
  $effect(() => {
    const captured = pending;
    if (
      $prepared.phase === "ready" &&
      captured.request === display &&
      current(captured.input)
    )
      adopted(captured.request, $prepared.parsed, captured.input);
  });
</script>

<RichPreparationStatus
  {lang}
  phase={$prepared.phase === "ready" ? "loading" : $prepared.phase}
  retry={() => owner.retry()}
/>
