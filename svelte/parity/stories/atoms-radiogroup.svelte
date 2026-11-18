<script lang="ts" module>
  export const layouts = { states: "padded" };
</script>

<script lang="ts">
  import Label from "../../lib/studio/Label.svelte";
  import RadioGroup from "../../lib/studio/RadioGroup.svelte";
  import RadioGroupItem from "../../lib/studio/RadioGroupItem.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const ROWS = ["Unselected", "Selected"] as const;
  const STATES = [undefined, "hover", "focus-visible", undefined];
</script>

{#if story === "default"}
  <RadioGroup value="member">
    <div class="flex items-center gap-2">
      <RadioGroupItem value="admin" id="role-admin" />
      <Label for="role-admin">Admin</Label>
    </div>
    <div class="flex items-center gap-2">
      <RadioGroupItem value="member" id="role-member" />
      <Label for="role-member">Member</Label>
    </div>
    <div class="flex items-center gap-2">
      <RadioGroupItem value="viewer" id="role-viewer" />
      <Label for="role-viewer">Viewer</Label>
    </div>
  </RadioGroup>
{:else if story === "with-descriptions"}
  <RadioGroup value="private" class="w-80">
    <div class="flex items-start gap-2">
      <RadioGroupItem value="private" id="vis-private" class="mt-0.5" />
      <div class="grid gap-1">
        <Label for="vis-private">Private</Label>
        <p class="text-sm text-pretty text-muted-foreground">
          Only members of this project can access it.
        </p>
      </div>
    </div>
    <div class="flex items-start gap-2">
      <RadioGroupItem value="internal" id="vis-internal" class="mt-0.5" />
      <div class="grid gap-1">
        <Label for="vis-internal">Internal</Label>
        <p class="text-sm text-pretty text-muted-foreground">
          Anyone in the organization can view this project.
        </p>
      </div>
    </div>
    <div class="flex items-start gap-2">
      <RadioGroupItem value="public" id="vis-public" class="mt-0.5" />
      <div class="grid gap-1">
        <Label for="vis-public">Public</Label>
        <p class="text-sm text-pretty text-muted-foreground">
          Anyone with the link can view this project.
        </p>
      </div>
    </div>
  </RadioGroup>
{:else if story === "disabled"}
  <RadioGroup value="monthly" disabled>
    <div class="flex items-center gap-2">
      <RadioGroupItem value="monthly" id="bill-monthly" />
      <Label for="bill-monthly">Monthly billing</Label>
    </div>
    <div class="flex items-center gap-2">
      <RadioGroupItem value="yearly" id="bill-yearly" />
      <Label for="bill-yearly">Yearly billing</Label>
    </div>
  </RadioGroup>
{:else if story === "horizontal"}
  <RadioGroup value="system" class="grid-flow-col">
    <div class="flex items-center gap-2">
      <RadioGroupItem value="light" id="theme-light" />
      <Label for="theme-light">Light</Label>
    </div>
    <div class="flex items-center gap-2">
      <RadioGroupItem value="dark" id="theme-dark" />
      <Label for="theme-dark">Dark</Label>
    </div>
    <div class="flex items-center gap-2">
      <RadioGroupItem value="system" id="theme-system" />
      <Label for="theme-system">System</Label>
    </div>
  </RadioGroup>
{:else if story === "states"}
  <Matrix columns={["Default", "Hover", "Focus", "Disabled"]} rows={ROWS}>
    {#snippet cell(row, index)}
      <RadioGroup
        value={row === "Selected" ? "on" : undefined}
        disabled={index === 3}
        aria-label={row}
      >
        <RadioGroupItem value="on" data-pseudo={STATES[index]} />
      </RadioGroup>
    {/snippet}
  </Matrix>
{/if}
