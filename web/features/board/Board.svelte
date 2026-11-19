<script lang="ts">
  import type { PanelProps } from "../../app/panels";
  import BoardPanel from "./BoardPanel.svelte";
  let props: PanelProps = $props();
</script>

{#key JSON.stringify([props.room.id, props.thread])}
  <BoardPanel {...props} />
{/key}
