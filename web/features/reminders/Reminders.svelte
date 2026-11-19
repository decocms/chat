<script lang="ts">
  import type { PanelProps } from "../../app/panels";
  import RemindersPanel from "./RemindersPanel.svelte";
  let { room, vb, request, ask }: PanelProps = $props();
</script>

{#key room.id}<RemindersPanel {room} {vb} {request} {ask} />{/key}
