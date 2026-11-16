<script lang="ts" module>
  export const layouts = { states: "padded", "with-chart": "padded" };
</script>

<script lang="ts">
  import MetricCard from "../../lib/studio/MetricCard.svelte";
  import Sparkline from "../../lib/studio/Sparkline.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const SERIES = [10, 11, 10, 12, 12, 12, 12, 13, 14, 14];
  const STATUSES = ["success", "warning", "error", undefined] as const;
</script>

{#snippet trend()}
  <Sparkline values={SERIES} />
{/snippet}

{#if story === "playground"}
  <div class="tw:w-64">
    <MetricCard
      label="Mobile conversion"
      value="1.84%"
      caption="Goal: 2.1%"
      status="success"
      {trend}
    />
  </div>
{:else if story === "states"}
  <Matrix
    columns={["On track", "Behind", "Off track", "No status"]}
    rows={["Metric"]}
  >
    {#snippet cell(_row, index)}
      <div class="tw:w-64">
        <MetricCard
          label="Mobile conversion"
          value="1.84%"
          caption="Goal: 2.1%"
          status={STATUSES[index]}
          {trend}
        />
      </div>
    {/snippet}
  </Matrix>
{:else if story === "clickable"}
  <MetricCard
    class="tw:w-64"
    interactive
    onclick={() => {}}
    label="Tasks done"
    value="42"
    caption="8 more than last week"
    status="success"
  />
{/if}
