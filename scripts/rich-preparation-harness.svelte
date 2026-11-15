<script lang="ts">
  import type { Writable } from "svelte/store";
  import type { Room } from "../shared/room";
  import type {
    RichMode,
    RichPolicy,
  } from "../svelte/features/rich-text/types";
  import type {
    createRichPreparation,
    HtmlTreeLoader,
  } from "../svelte/features/rich-text/preparation";
  import RichContent from "../svelte/features/rich-text/RichContent.svelte";
  let {
    value,
    loadHtml,
    createHtmlPreparation,
  }: {
    value: Writable<{
      text: string;
      room: Room;
      mode?: RichMode;
      policy?: RichPolicy;
    }>;
    loadHtml?: HtmlTreeLoader;
    createHtmlPreparation?: typeof createRichPreparation;
  } = $props();
</script>

<RichContent
  text={$value.text}
  room={$value.room}
  {loadHtml}
  {createHtmlPreparation}
  mode={$value.mode ?? "markdown"}
  policy={$value.policy}
  actions={{ navigate: () => {}, openFile: () => {} }}
/>
