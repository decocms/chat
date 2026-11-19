<script lang="ts">
  import type { Readable } from "svelte/store";
  import SuggestionPreview from "../web/features/room-sidebar/SuggestionPreview.svelte";
  import type { SuggestionPreviewProps } from "../web/features/room-sidebar/types";
  let { values }: { values: Readable<SuggestionPreviewProps> } = $props();
</script>

<SuggestionPreview {...$values} />
