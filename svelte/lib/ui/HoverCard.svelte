<script lang="ts">
  import { Tooltip } from "bits-ui";
  import type { Snippet } from "svelte";
  /**
   * Tip's wider sibling for rich details: opens on hover or keyboard focus like
   * Tip, and a tap toggles it on touch screens (a tooltip alone never opens there).
   * Render the element in `trigger` and spread the props it receives onto it.
   */
  let {
    side = "right",
    trigger,
    children,
  }: {
    side?: "top" | "right" | "bottom" | "left";
    trigger: Snippet<[Record<string, unknown>]>;
    children: Snippet;
  } = $props();
  let open = $state(false),
    touch = false;
</script>

<Tooltip.Provider delayDuration={100} skipDelayDuration={300}>
  <Tooltip.Root bind:open disableCloseOnTriggerClick>
    <Tooltip.Trigger
      onpointerdown={(event: PointerEvent) => {
        touch = event.pointerType === "touch";
      }}
      onclick={() => {
        if (touch) open = !open;
      }}
    >
      {#snippet child({ props })}{@render trigger(props)}{/snippet}
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content
        data-vb-native
        data-hover-card
        {side}
        sideOffset={8}
        collisionPadding={8}
        class="tw:z-50 tw:m-0 tw:box-border tw:w-64 tw:max-w-[calc(100vw-16px)] tw:space-y-2.5 tw:rounded-control tw:border tw:border-solid tw:border-border tw:bg-popover tw:px-3 tw:py-2.5 tw:font-sans tw:text-xs tw:leading-4 tw:text-popover-foreground tw:shadow-md"
        >{@render children()}</Tooltip.Content
      >
    </Tooltip.Portal>
  </Tooltip.Root>
</Tooltip.Provider>
