<script lang="ts" module>
  export interface EntityGridColumns {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    "2xl"?: number;
  }

  const GAPS: Record<number, string> = {
    0: "tw:gap-0",
    1: "tw:gap-1",
    2: "tw:gap-2",
    3: "tw:gap-3",
    4: "tw:gap-4",
    5: "tw:gap-5",
    6: "tw:gap-6",
    8: "tw:gap-8",
  };
  const COLS: Record<number, string> = {
    1: "tw:grid-cols-1",
    2: "tw:grid-cols-2",
    3: "tw:grid-cols-3",
    4: "tw:grid-cols-4",
    5: "tw:grid-cols-5",
    6: "tw:grid-cols-6",
    7: "tw:grid-cols-7",
    8: "tw:grid-cols-8",
  };
  const COLS_MD: Record<number, string> = {
    1: "tw:@min-3xl:grid-cols-1",
    2: "tw:@min-3xl:grid-cols-2",
    3: "tw:@min-3xl:grid-cols-3",
    4: "tw:@min-3xl:grid-cols-4",
    5: "tw:@min-3xl:grid-cols-5",
    6: "tw:@min-3xl:grid-cols-6",
    7: "tw:@min-3xl:grid-cols-7",
    8: "tw:@min-3xl:grid-cols-8",
  };
  const COLS_LG: Record<number, string> = {
    1: "tw:@min-6xl:grid-cols-1",
    2: "tw:@min-6xl:grid-cols-2",
    3: "tw:@min-6xl:grid-cols-3",
    4: "tw:@min-6xl:grid-cols-4",
    5: "tw:@min-6xl:grid-cols-5",
    6: "tw:@min-6xl:grid-cols-6",
    7: "tw:@min-6xl:grid-cols-7",
    8: "tw:@min-6xl:grid-cols-8",
  };
  const COLS_XL: Record<number, string> = {
    1: "tw:@min-7xl:grid-cols-1",
    2: "tw:@min-7xl:grid-cols-2",
    3: "tw:@min-7xl:grid-cols-3",
    4: "tw:@min-7xl:grid-cols-4",
    5: "tw:@min-7xl:grid-cols-5",
    6: "tw:@min-7xl:grid-cols-6",
    7: "tw:@min-7xl:grid-cols-7",
    8: "tw:@min-7xl:grid-cols-8",
  };
  const COLS_2XL: Record<number, string> = {
    1: "tw:@min-8xl:grid-cols-1",
    2: "tw:@min-8xl:grid-cols-2",
    3: "tw:@min-8xl:grid-cols-3",
    4: "tw:@min-8xl:grid-cols-4",
    5: "tw:@min-8xl:grid-cols-5",
    6: "tw:@min-8xl:grid-cols-6",
    7: "tw:@min-8xl:grid-cols-7",
    8: "tw:@min-8xl:grid-cols-8",
  };

  export const DEFAULT_ENTITY_GRID_COLUMNS: EntityGridColumns = {
    sm: 2,
    md: 3,
    lg: 4,
  };
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `EntityGrid`: columns follow the width of the nearest container. */
  let {
    children,
    columns = DEFAULT_ENTITY_GRID_COLUMNS,
    gap = 4,
    class: className,
  }: {
    children?: Snippet;
    columns?: EntityGridColumns;
    gap?: number;
    class?: string;
  } = $props();
</script>

<div
  class={cn(
    "tw:w-full tw:grid",
    GAPS[gap],
    columns.sm && COLS[columns.sm],
    columns.md && COLS_MD[columns.md],
    columns.lg && COLS_LG[columns.lg],
    columns.xl && COLS_XL[columns.xl],
    columns["2xl"] && COLS_2XL[columns["2xl"]],
    className,
  )}
>
  {@render children?.()}
</div>
