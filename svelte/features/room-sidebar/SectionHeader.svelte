<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { ChevronDown } from "../../lib/studio/icons";
  import { cn } from "../../lib/studio/utils";
  /**
   * The title row every titled room sidebar section shares: a 12px muted
   * label and an optional action at its end (a ghost `+`). `id` sits on the
   * title text alone, so a section labelled by it keeps its name. A
   * sub-section inside another section passes `level={4}`. With `ontoggle`
   * the title folds the section (`collapsed`), with a chevron and
   * aria-expanded.
   */
  let {
    title,
    id,
    level = 3,
    action,
    collapsed = false,
    ontoggle,
  }: {
    title: string;
    id?: string;
    level?: 3 | 4;
    action?: Snippet;
    collapsed?: boolean;
    ontoggle?: () => void;
  } = $props();
</script>

<!-- A section's title stays put while the sidebar scrolls under it, just below the room's own rows
  (--vb-sidebar-top, set by the sidebar; 0 elsewhere). -->
<div
  class={[
    "tw:flex tw:h-7 tw:items-center tw:justify-between tw:gap-2 tw:pr-0.5 tw:pl-2",
    level === 3 &&
      "tw:sticky tw:top-[var(--vb-sidebar-top,0px)] tw:z-10 tw:bg-sidebar",
  ]}
  data-section-header
>
  <svelte:element
    this={`h${level}`}
    class="tw:m-0 tw:min-w-0 tw:truncate tw:font-sans tw:text-xs tw:leading-4 tw:font-medium tw:tracking-normal tw:text-muted-foreground"
    >{#if ontoggle}<button
        type="button"
        aria-expanded={!collapsed}
        data-section-toggle
        class="tw:group/toggle tw:-ml-1 tw:flex tw:max-w-full tw:min-w-0 tw:cursor-pointer tw:items-center tw:gap-1 tw:rounded tw:border-0 tw:bg-transparent tw:px-1 tw:py-0.5 tw:font-[inherit] tw:text-[inherit] tw:hover:text-sidebar-foreground tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring"
        onclick={ontoggle}
        ><span class="tw:truncate" {id}>{title}</span><Icon
          icon={ChevronDown}
          size={12}
          class={cn(
            "tw:shrink-0 tw:opacity-0 tw:transition-[rotate,opacity] tw:duration-150 tw:ease-out tw:group-hover/toggle:opacity-100 tw:group-focus-visible/toggle:opacity-100 tw:motion-reduce:transition-none",
            collapsed && "tw:-rotate-90 tw:opacity-100",
          )}
        /></button
      >{:else}<span {id}>{title}</span>{/if}</svelte:element
  >
  {#if action}<div class="tw:flex tw:shrink-0 tw:items-center tw:gap-1">
      {@render action()}
    </div>{/if}
</div>
