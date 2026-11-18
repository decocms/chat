<script lang="ts">
  import type { PanelProps } from "./panels";
  import RemindersPanel from "./features/reminders/RemindersPanel.svelte";
  let { room, vb, request, ask }: PanelProps = $props();
</script>

{#key room.id}<RemindersPanel {room} {vb} {request} {ask} />{/key}
