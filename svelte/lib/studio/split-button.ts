import type { Snippet } from "svelte";

export interface SplitButtonMenuItem {
  /** Stable identity for the item; also its each-block key. */
  key: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  tooltip?: string;
  /** Rendered before the label. */
  icon?: Snippet;
}
