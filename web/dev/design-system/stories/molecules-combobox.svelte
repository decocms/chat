<script lang="ts">
  import Badge from "../../../lib/studio/Badge.svelte";
  import Combobox from "../../../lib/studio/Combobox.svelte";
  import type { ComboboxOption } from "../../../lib/studio/combobox";

  let { story }: { story: string } = $props();

  const frameworks: ComboboxOption[] = [
    { value: "production", label: "Production" },
    { value: "staging", label: "Staging" },
    { value: "development", label: "Development" },
    { value: "preview", label: "Preview" },
  ];

  const members: ComboboxOption[] = [
    { value: "ana", label: "Ana Souza", role: "Admin" },
    { value: "bruno", label: "Bruno Lima", role: "Member" },
    { value: "carla", label: "Carla Mendes", role: "Member" },
    { value: "diego", label: "Diego Santos", role: "Viewer" },
  ];

  let value = $state("");
  let preselected = $state("production");
  let member = $state("ana");
</script>

{#if story === "default"}
  <Combobox
    options={frameworks}
    {value}
    onChange={(next) => (value = next)}
    placeholder="Select environment..."
    searchPlaceholder="Search environments..."
    emptyMessage="No environment found."
  />
{:else if story === "preselected"}
  <Combobox
    options={frameworks}
    value={preselected}
    onChange={(next) => (preselected = next)}
    width="w-[240px]"
  />
{:else if story === "custom-item-rendering"}
  <Combobox
    options={members}
    value={member}
    onChange={(next) => (member = next)}
    width="w-[260px]"
    placeholder="Assign to..."
    searchPlaceholder="Search members..."
    emptyMessage="No member found."
  >
    {#snippet renderItem(option, isSelected)}
      <div class="flex w-full items-center justify-between gap-2">
        <span class={isSelected ? "font-medium" : undefined}>
          {option.label}
        </span>
        <Badge variant="outline">{String(option.role)}</Badge>
      </div>
    {/snippet}
  </Combobox>
{/if}
