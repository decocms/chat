<script lang="ts">
  import Sparkline from "../../../lib/studio/Sparkline.svelte";

  let { story }: { story: string } = $props();
</script>

<!-- Studio's page sets line-height 1.5, which sizes the line an inline sparkline sits on. -->
<div class="leading-[1.5]">
  {#if story === "playground"}
    <Sparkline values={[10, 11, 10, 12, 12, 12, 12, 13, 14, 14]} />
  {:else if story === "falling"}
    <Sparkline values={[14, 14, 13, 12, 12, 11, 10, 9, 8, 6]} />
  {/if}
</div>
