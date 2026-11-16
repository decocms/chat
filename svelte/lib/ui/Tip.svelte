<script lang="ts">
  import { Tooltip } from "bits-ui";
  import type { Snippet } from "svelte";
  /**
   * A styled tooltip around any element: render the element in `trigger` and
   * spread the props it receives onto it. Shows at once on hover or focus
   * (the browser's own `title` waits about a second and may not show at all).
   */
  let {
    label,
    side = "right",
    trigger,
  }: {
    label: string;
    side?: "top" | "right" | "bottom" | "left";
    trigger: Snippet<[Record<string, unknown>]>;
  } = $props();
</script>

<Tooltip.Provider delayDuration={0} skipDelayDuration={300}>
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}{@render trigger(props)}{/snippet}
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content
        data-vb-native
        {side}
        sideOffset={8}
        class="tw:z-50 tw:m-0 tw:box-border tw:max-w-xs tw:rounded-control tw:border tw:border-solid tw:border-border tw:bg-popover tw:px-3 tw:py-1.5 tw:font-sans tw:whitespace-pre-line tw:text-xs tw:font-medium tw:leading-4 tw:text-popover-foreground tw:shadow-md"
        >{label}</Tooltip.Content
      >
    </Tooltip.Portal>
  </Tooltip.Root>
</Tooltip.Provider>
