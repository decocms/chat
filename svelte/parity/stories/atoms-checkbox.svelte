<script lang="ts" module>
  export const layouts = { states: "padded" };
</script>

<script lang="ts">
  import Checkbox from "../../lib/studio/Checkbox.svelte";
  import Label from "../../lib/studio/Label.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const ROWS = ["Unchecked", "Checked", "Indeterminate"] as const;
  const STATES = [undefined, "hover", "focus-visible", undefined];
</script>

{#if story === "default"}
  <!-- The parity page lacks Studio's 1.5 root line height, which sets the line box around a bare inline control. -->
  <div class="tw:leading-[1.5]">
    <Checkbox aria-label="Accept terms" />
  </div>
{:else if story === "with-label"}
  <div class="tw:flex tw:items-center tw:gap-2">
    <Checkbox id="terms" />
    <Label for="terms">Accept terms and conditions</Label>
  </div>
{:else if story === "settings-group"}
  <div class="tw:grid tw:w-80 tw:gap-3">
    <p class="tw:text-sm tw:font-medium tw:text-pretty tw:text-foreground">
      Email notifications
    </p>
    <div class="tw:flex tw:items-start tw:gap-2">
      <Checkbox id="invites" checked class="tw:mt-0.5" />
      <div class="tw:grid tw:gap-1">
        <Label for="invites">Member invites</Label>
        <p class="tw:text-sm tw:text-pretty tw:text-muted-foreground">
          When someone invites a new member to the organization.
        </p>
      </div>
    </div>
    <div class="tw:flex tw:items-start tw:gap-2">
      <Checkbox id="deploys" checked class="tw:mt-0.5" />
      <div class="tw:grid tw:gap-1">
        <Label for="deploys">Deploy activity</Label>
        <p class="tw:text-sm tw:text-pretty tw:text-muted-foreground">
          When a project deploy succeeds or fails.
        </p>
      </div>
    </div>
    <div class="tw:flex tw:items-start tw:gap-2">
      <Checkbox id="digest" class="tw:mt-0.5" />
      <div class="tw:grid tw:gap-1">
        <Label for="digest">Weekly digest</Label>
        <p class="tw:text-sm tw:text-pretty tw:text-muted-foreground">
          A summary of usage across your projects.
        </p>
      </div>
    </div>
  </div>
{:else if story === "states"}
  <div class="tw:leading-[1.5]">
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
