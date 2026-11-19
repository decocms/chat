<script lang="ts" generics="Row extends string">
  import type { Snippet } from "svelte";

  /** Port of the Storybook kit's `Matrix`: variants in rows, states in columns. */
  let {
    columns,
    rows,
    labels = {},
    proposed = [],
    cell,
  }: {
    columns: string[];
    rows: readonly Row[];
    labels?: Partial<Record<Row, string>>;
    proposed?: string[];
    cell: Snippet<[Row, number]>;
  } = $props();
</script>

<div class="overflow-x-auto font-sans">
  <table class="border-separate border-spacing-x-6 border-spacing-y-4">
    <thead>
      <tr>
        <th></th>
        {#each columns as column (column)}
          <th
            class="text-left text-xs font-medium whitespace-nowrap text-subtle-foreground tabular-nums"
          >
            {column}{#if proposed.includes(column)}<span
                class="ml-1.5 rounded-full bg-brand-purple-tint px-1.5 py-px text-[0.625rem] text-brand-purple-dark"
                >proposed</span
              >{/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row (row)}
        <tr>
          <th
            class="pr-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground tabular-nums"
            >{labels[row] ?? row}</th
          >
          {#each columns as column, index (column)}
            <td class="align-middle tabular-nums">{@render cell(row, index)}</td
            >
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
