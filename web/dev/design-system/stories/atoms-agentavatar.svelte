<script lang="ts">
  import AgentAvatar from "../../../lib/studio/AgentAvatar.svelte";

  let { story }: { story: string } = $props();

  const AGENT_FACE =
    "https://assets.decocache.com/decocms/fd07a578-6b1c-40f1-bc05-88a3b981695d/f7fc4ffa81aec04e37ae670c3cd4936643a7b269.png";
  const SIZES = [16, 20, 24, 26, 32] as const;
</script>

<!-- Studio's root line height, which the parity page does not inherit. -->
<div class="leading-[1.5]">
  {#if story === "playground"}
    <AgentAvatar src={AGENT_FACE} size={26} alt="deco agent" />
  {:else if story === "sizes"}
    <div class="flex items-center gap-3">
      {#each SIZES as size (size)}
        <AgentAvatar src={AGENT_FACE} {size} alt="deco agent" />
      {/each}
    </div>
  {/if}
</div>
