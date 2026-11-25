<script lang="ts" module>
  /** The card's quiet right-side icons: no chrome until hover, one step darker than the card on hover. */
  export const cardIconClass =
    "text-muted-foreground hover:bg-input hover:text-foreground";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import type { IconName } from "../../lib/studio/icons";
  /**
   * One card for everything a message carries as a file (a room app, a Markdown note, a PDF): a flat solid
   * gray block with a tile, the name, a muted meta line and quiet icons. The body is one button (its main action).
   * The gray is one step darker than a hovered message row, so the card holds when the row lights up.
   */
  let {
    icon,
    name,
    meta,
    disabled = false,
    open,
    openData = {},
    trailing,
    ...rest
  }: {
    icon: IconName;
    name: string;
    meta: string;
    disabled?: boolean;
    open: (event: MouseEvent & { currentTarget: HTMLButtonElement }) => void;
    /** data-* attributes for the body button (what tests and callers look up). */
    openData?: Record<`data-${string}`, string | boolean>;
    /** The quiet icons at the right. */
    trailing?: Snippet;
    [key: `data-${string}`]: string | boolean | undefined;
  } = $props();
</script>

<div
  {...rest}
  data-attachment-card
  class="flex w-full max-w-md min-w-0 items-center gap-1 rounded-2xl bg-secondary-hover p-1.5 pr-2.5"
>
  <button
    type="button"
    {...openData}
    {disabled}
    class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl border-0 bg-transparent p-2 text-left text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default"
    onclick={open}
    ><span
      data-card-icon
      aria-hidden="true"
      class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-input text-muted-foreground"
      ><Icon {icon} size={18} /></span
    ><span class="min-w-0 flex-1"
      ><span data-card-name class="block truncate text-base text-foreground"
        >{name}</span
      ><span data-card-meta class="block truncate text-sm text-muted-foreground"
        >{meta}</span
      ></span
    ></button
  >{@render trailing?.()}
</div>
