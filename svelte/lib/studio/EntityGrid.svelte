<script lang="ts" module>
  export interface EntityGridColumns {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    "2xl"?: number;
  }

  const GAPS: Record<number, string> = {
    0: "gap-0",
    1: "gap-1",
    2: "gap-2",
    3: "gap-3",
    4: "gap-4",
    5: "gap-5",
    6: "gap-6",
    8: "gap-8",
  };
  const COLS: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
    6: "grid-cols-6",
    7: "grid-cols-7",
    8: "grid-cols-8",
  };
  const COLS_MD: Record<number, string> = {
    1: "@min-3xl:grid-cols-1",
    2: "@min-3xl:grid-cols-2",
    3: "@min-3xl:grid-cols-3",
    4: "@min-3xl:grid-cols-4",
    5: "@min-3xl:grid-cols-5",
    6: "@min-3xl:grid-cols-6",
    7: "@min-3xl:grid-cols-7",
    8: "@min-3xl:grid-cols-8",
  };
  const COLS_LG: Record<number, string> = {
    1: "@min-6xl:grid-cols-1",
    2: "@min-6xl:grid-cols-2",
    3: "@min-6xl:grid-cols-3",
    4: "@min-6xl:grid-cols-4",
    5: "@min-6xl:grid-cols-5",
    6: "@min-6xl:grid-cols-6",
    7: "@min-6xl:grid-cols-7",
    8: "@min-6xl:grid-cols-8",
  };
  const COLS_XL: Record<number, string> = {
    1: "@min-7xl:grid-cols-1",
    2: "@min-7xl:grid-cols-2",
    3: "@min-7xl:grid-cols-3",
    4: "@min-7xl:grid-cols-4",
    5: "@min-7xl:grid-cols-5",
    6: "@min-7xl:grid-cols-6",
    7: "@min-7xl:grid-cols-7",
    8: "@min-7xl:grid-cols-8",
  };
  const COLS_2XL: Record<number, string> = {
    1: "@min-8xl:grid-cols-1",
    2: "@min-8xl:grid-cols-2",
    3: "@min-8xl:grid-cols-3",
    4: "@min-8xl:grid-cols-4",
    5: "@min-8xl:grid-cols-5",
    6: "@min-8xl:grid-cols-6",
    7: "@min-8xl:grid-cols-7",
    8: "@min-8xl:grid-cols-8",
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
    "w-full grid",
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
