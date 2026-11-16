<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import Icon from "../../lib/ui/Icon.svelte";
  import type { IconName } from "../../lib/ui/icons";
  /**
   * Same 48px box and 40px rounded tile as a room in the rail, so the home and
   * action buttons read as part of the same column. `current` draws the same
   * inset ring a selected room gets.
   */
  let {
    label,
    icon,
    current = false,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLButtonAttributes, "style" | "class" | "children"> & {
    label: string;
    icon?: IconName;
    current?: boolean;
    ref?: HTMLButtonElement | null;
    children?: Snippet;
  } = $props();
</script>

<button
  {...rest}
  bind:this={ref}
  type="button"
  aria-label={label}
  title={label}
  aria-current={current ? "page" : undefined}
  class="tw:group tw:relative tw:flex tw:cursor-pointer tw:size-12 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-control tw:outline-none tw:ring-inset tw:focus-visible:ring-2 tw:focus-visible:ring-ring tw:aria-[current=page]:ring-2 tw:aria-[current=page]:ring-primary"
>
  <span
    class="tw:grid tw:size-10 tw:place-items-center tw:rounded-control tw:bg-muted tw:font-sans tw:text-sm tw:font-semibold tw:text-foreground tw:transition-colors tw:group-hover:bg-accent tw:motion-reduce:transition-none"
  >
    {#if icon}<Icon name={icon} class="tw:size-5" />{/if}{@render children?.()}
  </span>
</button>
