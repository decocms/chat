<script lang="ts">
  import type { Writable } from "svelte/store";
  import type { Room } from "../shared/room";
  import type { HtmlTreeLoader } from "../svelte/features/rich-text/preparation";
  import RichContent from "../svelte/features/rich-text/RichContent.svelte";
  let {
    value,
    loadHtml,
  }: {
    value: Writable<{ text: string; room: Room }>;
    loadHtml?: HtmlTreeLoader;
  } = $props();
</script>

<RichContent
  text={$value.text}
  room={$value.room}
  {loadHtml}
  actions={{ navigate: () => {}, openFile: () => {} }}
/>
