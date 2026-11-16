<script lang="ts">
  import Label from "../../lib/studio/Label.svelte";
  import Slider from "../../lib/studio/Slider.svelte";

  let { story }: { story: string } = $props();

  let temperature = $state([0.7]);
</script>

{#if story === "default"}
  <div class="tw:w-80">
    <Slider value={[50]} max={100} step={1} />
  </div>
{:else if story === "with-value-label"}
  <div class="tw:grid tw:w-80 tw:gap-3">
    <div class="tw:flex tw:items-center tw:justify-between">
      <Label for="temperature">Temperature</Label>
      <span class="tw:text-sm tw:text-muted-foreground">{temperature[0]}</span>
    </div>
    <Slider
      id="temperature"
      bind:value={temperature}
      min={0}
      max={2}
      step={0.1}
    />
    <p class="tw:text-sm tw:text-pretty tw:text-muted-foreground">
      Higher values make model output more creative.
    </p>
  </div>
{:else if story === "range"}
  <div class="tw:grid tw:w-80 tw:gap-3">
    <Label>Retry delay window (seconds)</Label>
    <Slider value={[5, 60]} min={0} max={120} step={5} />
  </div>
{:else if story === "disabled"}
  <div class="tw:w-80">
    <Slider value={[30]} disabled />
  </div>
{:else if story === "vertical"}
  <div class="tw:h-48">
    <Slider value={[60]} orientation="vertical" />
  </div>
{/if}
