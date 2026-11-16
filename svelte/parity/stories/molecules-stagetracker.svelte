<script lang="ts" module>
  export const layouts = { states: "padded" };
</script>

<script lang="ts">
  import Stage from "../../lib/studio/Stage.svelte";
  import StageTracker from "../../lib/studio/StageTracker.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const STAGES = ["Plan", "Execute", "Monitor"];
  const WIZARD = ["Connect", "Configure", "Review"];
  const STAGE_STATES = ["done", "current", "upcoming"] as const;
  const ROWS = ["Plan", "Execute", "Monitor", "Done"] as const;
  const VISITED = new Set([0, 1, 2]);

  let current = $state(2);
</script>

{#if story === "playground"}
  <StageTracker stages={STAGES} current={1} />
{:else if story === "states"}
  <!-- The line height is the one Studio pages inherit; a lone pill in a table cell sits on that line. -->
  <div class="tw:flex tw:flex-col tw:gap-8 tw:leading-[1.5]">
    <Matrix columns={["Done", "Current", "Upcoming"]} rows={["Stage"]}>
      {#snippet cell(_row, index)}
        <Stage state={STAGE_STATES[index] ?? "upcoming"}>Plan</Stage>
      {/snippet}
    </Matrix>
    <Matrix columns={["pill", "numbered"]} rows={ROWS}>
      {#snippet cell(row, index)}
        {#if index === 0}
          <StageTracker stages={STAGES} current={ROWS.indexOf(row)} />
        {:else}
          <StageTracker
            variant="numbered"
            stages={WIZARD}
            current={ROWS.indexOf(row)}
          />
        {/if}
      {/snippet}
    </Matrix>
  </div>
{:else if story === "wizard"}
  <StageTracker
    variant="numbered"
    stages={WIZARD}
    {current}
    onStageClick={(index) => (current = index)}
    visited={VISITED}
  />
{/if}
