<script lang="ts">
  import type { PanelProps } from "../../app/panels";
  import DecisionsPanel from "./DecisionsPanel.svelte";
  let { room, vb, request, ask }: PanelProps = $props();
</script>

{#key room.id}<DecisionsPanel {room} {vb} {request} {ask} />{/key}
