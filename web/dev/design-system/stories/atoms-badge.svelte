<script lang="ts" module>
  export const layouts = { tones: "padded" };
</script>

<script lang="ts">
  import Badge from "../../../lib/studio/Badge.svelte";
  import BadgeDot from "../../../lib/studio/BadgeDot.svelte";
  import Icon from "../../../lib/studio/Icon.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const SIZES = ["sm", "default", "lg"] as const;
  const TONE_ROWS = [
    "default",
    "success",
    "warning",
    "destructive",
    "agent",
    "lime",
    "info",
    "outline",
  ] as const;
</script>

<!-- Studio's root line height, which this page does not inherit. -->
<div class="leading-[1.5]">
  {#if story === "default"}
    <Badge variant="default" size="default">Active</Badge>
  {:else if story === "variants"}
    <div class="flex flex-wrap items-center gap-2">
      <Badge>Default</Badge>
      <Badge variant="success">On track</Badge>
      <Badge variant="warning">Behind</Badge>
      <Badge variant="destructive">Needs attention</Badge>
      <Badge variant="agent">Agent proposal</Badge>
      <Badge variant="lime">Live</Badge>
      <Badge variant="info">Info</Badge>
      <Badge variant="outline">Checkout</Badge>
    </div>
  {:else if story === "sizes"}
    <div class="flex flex-col gap-2">
      {#each SIZES as size (size)}
        <div class="flex items-center gap-2">
          <Badge {size}>14</Badge>
          <Badge {size} variant="success"><BadgeDot /> Working</Badge>
          <Badge {size} variant="warning"><BadgeDot /> Behind</Badge>
          <Badge {size} variant="outline">merged</Badge>
        </div>
      {/each}
    </div>
  {:else if story === "with-icon"}
    <div class="flex flex-wrap items-center gap-2">
      <Badge variant="success"><Icon icon="check-circle" /> Verified</Badge>
      <Badge size="icon" aria-label="Add tag"><Icon icon="plus" /></Badge>
    </div>
  {:else if story === "status-row"}
    <div class="flex items-center gap-3 text-sm">
      <span class="text-foreground">production-db</span>
      <Badge variant="success">Healthy</Badge>
      <span class="text-foreground">staging-db</span>
      <Badge variant="warning">Degraded</Badge>
      <span class="text-foreground">legacy-api</span>
      <Badge variant="destructive">Offline</Badge>
    </div>
  {:else if story === "tones"}
    <Matrix
      columns={[
        "sm · 18 · counts",
        "default · 22",
        "lg · 24 · tags",
        "With dot",
      ]}
      rows={TONE_ROWS}
      labels={{ default: "neutral", destructive: "error" }}
    >
      {#snippet cell(variant, index)}
        {#if index === 0}
          <Badge {variant} size="sm">14</Badge>
        {:else if index === 1}
          <Badge {variant}>On track</Badge>
        {:else if index === 2}
          <Badge {variant} size="lg">Checkout</Badge>
        {:else}
          <Badge {variant}><BadgeDot /> Working</Badge>
        {/if}
      {/snippet}
    </Matrix>
  {/if}
</div>
