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

<div class="tw:overflow-x-auto tw:font-sans">
  <table class="tw:border-separate tw:border-spacing-x-6 tw:border-spacing-y-4">
    <thead>
      <tr>
        <th></th>
        {#each columns as column (column)}
          <th
            class="tw:text-left tw:text-xs tw:font-medium tw:whitespace-nowrap tw:text-subtle-foreground tw:tabular-nums"
          >
            {column}{#if proposed.includes(column)}<span
                class="tw:ml-1.5 tw:rounded-full tw:bg-brand-purple-tint tw:px-1.5 tw:py-px tw:text-[0.625rem] tw:text-brand-purple-dark"
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
            class="tw:pr-2 tw:text-left tw:text-xs tw:font-medium tw:whitespace-nowrap tw:text-muted-foreground tw:tabular-nums"
            >{labels[row] ?? row}</th
          >
          {#each columns as column, index (column)}
            <td class="tw:align-middle tw:tabular-nums"
              >{@render cell(row, index)}</td
            >
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
