<script lang="ts" module>
  export const layouts = { states: "padded" };
</script>

<script lang="ts">
  import Checkbox from "../../../lib/studio/Checkbox.svelte";
  import Label from "../../../lib/studio/Label.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const ROWS = ["Unchecked", "Checked", "Indeterminate"] as const;
  const STATES = [undefined, "hover", "focus-visible", undefined];
</script>

{#if story === "default"}
  <!-- The parity page lacks Studio's 1.5 root line height, which sets the line box around a bare inline control. -->
  <div class="leading-[1.5]">
    <Checkbox aria-label="Accept terms" />
  </div>
{:else if story === "with-label"}
  <div class="flex items-center gap-2">
    <Checkbox id="terms" />
    <Label for="terms">Accept terms and conditions</Label>
  </div>
{:else if story === "settings-group"}
  <div class="grid w-80 gap-3">
    <p class="text-sm font-medium text-pretty text-foreground">
      Email notifications
    </p>
    <div class="flex items-start gap-2">
      <Checkbox id="invites" checked class="mt-0.5" />
      <div class="grid gap-1">
        <Label for="invites">Member invites</Label>
        <p class="text-sm text-pretty text-muted-foreground">
          When someone invites a new member to the organization.
        </p>
      </div>
    </div>
    <div class="flex items-start gap-2">
      <Checkbox id="deploys" checked class="mt-0.5" />
      <div class="grid gap-1">
        <Label for="deploys">Deploy activity</Label>
        <p class="text-sm text-pretty text-muted-foreground">
          When a project deploy succeeds or fails.
        </p>
      </div>
    </div>
    <div class="flex items-start gap-2">
      <Checkbox id="digest" class="mt-0.5" />
      <div class="grid gap-1">
        <Label for="digest">Weekly digest</Label>
        <p class="text-sm text-pretty text-muted-foreground">
          A summary of usage across your projects.
        </p>
      </div>
    </div>
  </div>
{:else if story === "states"}
  <div class="leading-[1.5]">
    <Matrix columns={["Default", "Hover", "Focus", "Disabled"]} rows={ROWS}>
      {#snippet cell(row, index)}
        <Checkbox
          checked={row === "Checked"}
          indeterminate={row === "Indeterminate"}
          data-pseudo={STATES[index]}
          disabled={index === 3}
          aria-label={row}
        />
      {/snippet}
    </Matrix>
  </div>
{/if}
