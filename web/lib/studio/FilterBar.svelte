<script lang="ts">
  import { tick, type Snippet } from "svelte";
  import Button from "./Button.svelte";
  import Command from "./Command.svelte";
  import CommandEmpty from "./CommandEmpty.svelte";
  import CommandGroup from "./CommandGroup.svelte";
  import CommandInput from "./CommandInput.svelte";
  import CommandItem from "./CommandItem.svelte";
  import CommandList from "./CommandList.svelte";
  import DropdownMenu from "./DropdownMenu.svelte";
  import DropdownMenuContent from "./DropdownMenuContent.svelte";
  import DropdownMenuItem from "./DropdownMenuItem.svelte";
  import DropdownMenuSeparator from "./DropdownMenuSeparator.svelte";
  import DropdownMenuTrigger from "./DropdownMenuTrigger.svelte";
  import type {
    Filter,
    FilterBarUser,
    FilterColumn,
    FilterOperator,
  } from "./filter-bar";
  import Icon from "./Icon.svelte";
  import Input from "./Input.svelte";

  /** Ported from @decocms/ui `FilterBar`. Controlled: `filters` changes only through `onFiltersChange`. The render props are snippets. */
  let {
    filters,
    onFiltersChange,
    availableUsers = [],
    renderUserItem,
    renderUserFilter,
  }: {
    filters: Filter[];
    onFiltersChange: (filters: Filter[]) => void;
    availableUsers?: FilterBarUser[];
    renderUserItem?: Snippet<[FilterBarUser]>;
    renderUserFilter?: Snippet<
      [{ users: FilterBarUser[]; onSelect: (userId: string) => void }]
    >;
  } = $props();

  const COLUMN_LABELS: Record<FilterColumn, string> = {
    name: "Name",
    description: "Description",
    created_at: "Date created",
    updated_at: "Date updated",
    created_by: "Created by",
    updated_by: "Updated by",
  };
  const COLUMNS = Object.entries(COLUMN_LABELS) as [FilterColumn, string][];

  const TEXT_OPERATORS: Record<string, string> = {
    contains: "contains",
    does_not_contain: "does not contain",
    is: "is",
    is_not: "is not",
  };

  const USER_OPERATORS: Record<string, string> = { is: "is" };

  const DATE_PRESETS = [
    { label: "Last 7 days", value: "7d" },
    { label: "Last 30 days", value: "30d" },
    { label: "Last 3 months", value: "3m" },
    { label: "All time", value: "all" },
  ];

  type TextColumn = "name" | "description";
  type UserColumn = "created_by" | "updated_by";

  function isTextColumn(column: FilterColumn): column is TextColumn {
    return column === "name" || column === "description";
  }

  function isUserColumn(column: FilterColumn): column is UserColumn {
    return column === "created_by" || column === "updated_by";
  }

  function getOperatorsForColumn(column: FilterColumn): Record<string, string> {
    if (isTextColumn(column)) return TEXT_OPERATORS;
    if (isUserColumn(column)) return USER_OPERATORS;
    return { in_last: "in last" };
  }

  function getDefaultOperatorForAutoStep(
    column: FilterColumn,
  ): FilterOperator | null {
    if (isUserColumn(column)) return "is";
    if (isTextColumn(column)) return null;
    return "in_last";
  }

  function getDefaultValue(column: FilterColumn): string {
    return isTextColumn(column) || isUserColumn(column) ? "" : "7d";
  }

  let addingFilter = $state(false);
  let selectedColumn = $state<FilterColumn | null>(null);
  let selectedOperator = $state<FilterOperator | null>(null);
  let filterValue = $state("");
  let editingFilterId = $state<string | null>(null);

  const userLookup = $derived(
    new Map(availableUsers.map((user) => [user.id, user])),
  );

  function addFilter(
    column: FilterColumn,
    operator: FilterOperator,
    value: string,
  ) {
    if (editingFilterId) {
      onFiltersChange(
        filters.map((f) =>
          f.id === editingFilterId ? { id: f.id, column, operator, value } : f,
        ),
      );
    } else {
      onFiltersChange([
        ...filters,
        { id: crypto.randomUUID(), column, operator, value },
      ]);
    }
    resetAddFilter();
  }

  function removeFilter(filterId: string) {
    onFiltersChange(filters.filter((f) => f.id !== filterId));
  }

  function resetAddFilter() {
    addingFilter = false;
    selectedColumn = null;
    selectedOperator = null;
    filterValue = "";
    editingFilterId = null;
  }

  function editFilter(filter: Filter) {
    editingFilterId = filter.id;
    selectedColumn = filter.column;
    selectedOperator = isTextColumn(filter.column)
      ? filter.operator
      : getDefaultOperatorForAutoStep(filter.column);
    filterValue = filter.value;
    addingFilter = true;
  }

  function getFilterLabel(filter: Filter): string {
    const columnLabel = COLUMN_LABELS[filter.column];
    if (isTextColumn(filter.column)) {
      const operatorLabel =
        getOperatorsForColumn(filter.column)[filter.operator] ||
        filter.operator;
      return `${columnLabel} ${operatorLabel} "${filter.value}"`;
    }
    if (!isUserColumn(filter.column)) {
      const preset = DATE_PRESETS.find((p) => p.value === filter.value);
      return `${columnLabel}: ${preset ? preset.label : filter.value}`;
    }
    return columnLabel;
  }

  let contentRef = $state<HTMLElement | null>(null);

  /** Radix keeps focus in the open menu: on the panel, or on the field that asks for it. Bits UI would pick the back arrow on open and drop focus when a step replaces the focused row. */
  function restoreFocus() {
    if (!addingFilter || !contentRef) return;
    if (contentRef.contains(document.activeElement)) return;
    const target =
      contentRef.querySelector<HTMLElement>("[autofocus]") ?? contentRef;
    target.focus({ preventScroll: true });
  }

  function focusPanel(event: Event) {
    event.preventDefault();
    requestAnimationFrame(restoreFocus);
  }

  $effect(() => {
    void selectedColumn;
    void selectedOperator;
    void tick().then(restoreFocus);
  });

  function back(column: FilterColumn) {
    if (!isTextColumn(column) || !selectedOperator) selectedColumn = null;
    selectedOperator = null;
  }
</script>

{#snippet header(column: FilterColumn, title: string)}
  <div class="px-2 py-1.5 flex items-center gap-2">
    <Button
      variant="ghost"
      size="icon"
      class="h-6 w-6"
      onclick={() => back(column)}
    >
      <Icon icon="arrow-left" size={16} />
    </Button>
    <p class="text-xs text-pretty text-muted-foreground uppercase font-mono">
      {title}
    </p>
  </div>
  <DropdownMenuSeparator />
{/snippet}

{#snippet userSelection(onSelect: (userId: string) => void)}
  {#if renderUserFilter}
    {@render renderUserFilter({ users: availableUsers, onSelect })}
  {:else}
    <Command class="border-0">
      <CommandInput placeholder="Search users..." class="h-9" />
      <CommandList>
        <CommandEmpty>No users found.</CommandEmpty>
        <CommandGroup>
          {#each availableUsers as user (user.id)}
            <CommandItem onSelect={() => onSelect(user.id)}>
              {#if renderUserItem}
                {@render renderUserItem(user)}
              {:else}
                <span class="truncate">{user.name ?? user.id}</span>
              {/if}
            </CommandItem>
          {/each}
        </CommandGroup>
      </CommandList>
    </Command>
  {/if}
{/snippet}

{#snippet dropdownContent()}
  {#if !selectedColumn}
    <div class="px-2 py-1.5">
      <p class="text-xs text-pretty text-muted-foreground uppercase font-mono">
        Select to filter
      </p>
    </div>
    {#each COLUMNS as [column, label] (column)}
      <DropdownMenuItem
        closeOnSelect={false}
        onSelect={() => {
          selectedColumn = column;
          selectedOperator = getDefaultOperatorForAutoStep(column);
          filterValue = getDefaultValue(column);
        }}
      >
        {label}
      </DropdownMenuItem>
    {/each}
  {:else if selectedOperator && isUserColumn(selectedColumn) && availableUsers.length === 0 && !renderUserFilter}
    <div class="px-2 py-3 text-sm text-muted-foreground">
      No users available for filtering.
    </div>
  {:else}
    {@const column = selectedColumn}
    {@const operator = selectedOperator}
    <!-- One header for the operator and value steps, so the back arrow keeps focus between them. -->
    {@render header(
      column,
      operator && isTextColumn(column)
        ? `${COLUMN_LABELS[column]} ${getOperatorsForColumn(column)[operator]}`
        : COLUMN_LABELS[column],
    )}
    {#if !operator}
      {#each Object.entries(getOperatorsForColumn(column)) as [key, label] (key)}
        <DropdownMenuItem
          closeOnSelect={false}
          onSelect={() => {
            selectedOperator = key as FilterOperator;
          }}
        >
          {label}
        </DropdownMenuItem>
      {/each}
    {:else if isTextColumn(column)}
      <div class="p-2">
        <!-- svelte-ignore a11y_autofocus -->
        <Input
          autofocus
          placeholder="Enter value..."
          bind:value={filterValue}
          onkeydown={(event) => {
            if (event.key === "Enter" && filterValue) {
              // Without this the same key press would activate the trigger that focus returns to.
              event.preventDefault();
              addFilter(column, operator, filterValue);
            }
          }}
          class="h-8"
        />
        <Button
          size="sm"
          class="w-full mt-2"
          onclick={() => {
            if (filterValue) addFilter(column, operator, filterValue);
          }}
          disabled={!filterValue}
        >
          Apply
        </Button>
      </div>
    {:else if isUserColumn(column)}
      {@render userSelection((userId) => addFilter(column, operator, userId))}
    {:else}
      {#each DATE_PRESETS as preset (preset.value)}
        <DropdownMenuItem
          closeOnSelect={false}
          onSelect={() => addFilter(column, operator, preset.value)}
        >
          {preset.label}
        </DropdownMenuItem>
      {/each}
    {/if}
  {/if}
{/snippet}

<div class="flex items-center gap-2 flex-wrap">
  {#each filters as filter (filter.id)}
    {@const editing = addingFilter && editingFilterId === filter.id}
    {@const userData =
      isUserColumn(filter.column) && filter.value
        ? (userLookup.get(filter.value) ?? { id: filter.value })
        : undefined}
    <DropdownMenu
      bind:open={
        () => editing,
        (open) => {
          if (!open && editingFilterId === filter.id) resetAddFilter();
        }
      }
    >
      <DropdownMenuTrigger>
        {#snippet child({ props })}
          <div
            {...props}
            class="group flex items-center gap-1 px-3 h-8 bg-accent rounded-lg text-sm cursor-pointer hover:bg-secondary-hover transition-colors"
            onclick={() => editFilter(filter)}
          >
            {#if userData}
              <div class="flex items-center gap-2">
                <!-- The colon is its own text node, as in React: one node measures 1/64px narrower. -->
                <span class="text-muted-foreground"
                  >{COLUMN_LABELS[filter.column]}{#if true}:{/if}</span
                >
                {#if renderUserItem}
                  {@render renderUserItem(userData)}
                {:else}
                  <span class="text-foreground">
                    {userData.name ?? userData.id}
                  </span>
                {/if}
              </div>
            {:else}
              <span class="text-foreground">{getFilterLabel(filter)}</span>
            {/if}
            <button
              type="button"
              onclick={(event) => {
                event.stopPropagation();
                removeFilter(filter.id);
              }}
              class="flex items-center justify-center w-0 opacity-0 group-hover:w-4 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all overflow-hidden cursor-pointer disabled:cursor-not-allowed"
            >
              <Icon icon="x" size={16} />
            </button>
          </div>
        {/snippet}
      </DropdownMenuTrigger>
      {#if editing}
        <!-- Radix removes the focused panel's outline itself. -->
        <DropdownMenuContent
          bind:ref={contentRef}
          align="start"
          class="w-64 outline-none"
          onOpenAutoFocus={focusPanel}
        >
          {@render dropdownContent()}
        </DropdownMenuContent>
      {/if}
    </DropdownMenu>
  {/each}

  <DropdownMenu
    bind:open={
      () => addingFilter && !editingFilterId,
      (open) => {
        if (open) addingFilter = true;
        else resetAddFilter();
      }
    }
  >
    <DropdownMenuTrigger>
      {#snippet child({ props })}
        <Button
          {...props}
          variant="ghost"
          size="sm"
          class="h-8 text-muted-foreground hover:text-foreground"
        >
          <Icon icon="plus" size={16} />
          Add filter
        </Button>
      {/snippet}
    </DropdownMenuTrigger>
    <DropdownMenuContent
      bind:ref={contentRef}
      align="start"
      class="w-64 outline-none"
      onOpenAutoFocus={focusPanel}
    >
      {@render dropdownContent()}
    </DropdownMenuContent>
  </DropdownMenu>
</div>
