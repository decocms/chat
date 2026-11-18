<script lang="ts" module>
  export const layouts = { states: "padded" };
</script>

<script lang="ts">
  import Label from "../../lib/studio/Label.svelte";
  import Switch from "../../lib/studio/Switch.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const ROWS = ["Off", "On"] as const;
  const STATES = [undefined, "focus-visible", undefined];
</script>

{#if story === "default"}
  <!-- The parity page lacks Studio's 1.5 root line height, which sets the line box around a bare inline control. -->
  <div class="leading-[1.5]">
    <Switch aria-label="Toggle setting" />
  </div>
{:else if story === "with-label"}
  <div class="flex items-center gap-2">
    <Switch id="airplane" />
    <Label for="airplane">Enable notifications</Label>
  </div>
{:else if story === "settings-row"}
  <div class="grid w-96 gap-4">
    <div class="flex items-center justify-between gap-4">
      <div class="grid gap-1">
        <Label for="tracing">Distributed tracing</Label>
        <p class="text-sm text-pretty text-muted-foreground">
          Record a trace for every tool call in this project.
        </p>
      </div>
      <Switch id="tracing" checked />
    </div>
    <div class="flex items-center justify-between gap-4">
      <div class="grid gap-1">
        <Label for="audit">Audit logging</Label>
        <p class="text-sm text-pretty text-muted-foreground">
          Keep a log of member and connection changes.
        </p>
      </div>
      <Switch id="audit" checked />
    </div>
    <div class="flex items-center justify-between gap-4">
      <div class="grid gap-1">
        <Label for="beta">Beta features</Label>
        <p class="text-sm text-pretty text-muted-foreground">
          Try new features before they roll out to everyone.
        </p>
      </div>
      <Switch id="beta" />
    </div>
  </div>
{:else if story === "states"}
  <div class="leading-[1.5]">
    <Matrix columns={["Default", "Focus", "Disabled"]} rows={ROWS}>
      {#snippet cell(row, index)}
        <Switch
          checked={row === "On"}
          data-pseudo={STATES[index]}
          disabled={index === 2}
          aria-label={row}
        />
      {/snippet}
    </Matrix>
  </div>
{/if}
