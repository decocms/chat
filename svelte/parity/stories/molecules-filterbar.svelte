<script module lang="ts">
  export const layouts = {
    default: "padded",
    "with-filters": "padded",
    "custom-user-rendering": "padded",
  } as const;
</script>

<script lang="ts">
  import type { Filter, FilterBarUser } from "../../lib/studio/filter-bar";
  import FilterBar from "../../lib/studio/FilterBar.svelte";

  let { story }: { story: string } = $props();

  const teamMembers: FilterBarUser[] = [
    { id: "user-1", name: "Ana Souza" },
    { id: "user-2", name: "Bruno Lima" },
    { id: "user-3", name: "Carla Mendes" },
    { id: "user-4", name: "Diego Ferreira" },
  ];

  const INITIAL: Record<string, Filter[]> = {
    default: [],
    "with-filters": [
      { id: "f-1", column: "name", operator: "contains", value: "support" },
      { id: "f-2", column: "created_by", operator: "is", value: "user-2" },
      { id: "f-3", column: "updated_at", operator: "in_last", value: "7d" },
    ],
    "custom-user-rendering": [
      { id: "f-1", column: "created_by", operator: "is", value: "user-1" },
    ],
  };

  // svelte-ignore state_referenced_locally
  let filters = $state<Filter[]>(INITIAL[story] ?? []);

  function initials(name: string) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("");
  }
</script>

{#if story === "default" || story === "with-filters"}
  <div class="tw:w-[640px]">
    <FilterBar
      {filters}
      onFiltersChange={(next) => (filters = next)}
      availableUsers={teamMembers}
    />
  </div>
{:else if story === "custom-user-rendering"}
  <div class="tw:w-[640px]">
    <FilterBar
      {filters}
      onFiltersChange={(next) => (filters = next)}
      availableUsers={teamMembers}
    >
      {#snippet renderUserItem(user)}
        <span class="tw:flex tw:items-center tw:gap-2">
          <span
            class="tw:flex tw:size-5 tw:items-center tw:justify-center tw:rounded-full tw:bg-primary tw:text-[10px] tw:font-medium tw:text-primary-foreground"
          >
            {initials(user.name ?? user.id)}
          </span>
          <span class="tw:truncate">{user.name ?? user.id}</span>
        </span>
      {/snippet}
    </FilterBar>
  </div>
{/if}
