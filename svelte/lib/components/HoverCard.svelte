<script lang="ts">
  import { Tooltip as TooltipPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";
  import TooltipProvider from "../studio/TooltipProvider.svelte";
  import { cn } from "../studio/utils";
  import { studioType } from "./type";

  /** Rich details on a popover surface: opens on hover or keyboard focus, and a tap toggles it on touch screens (a tooltip alone never opens there). Render the element in `trigger` and spread the props it receives onto it. */
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

<TooltipProvider delayDuration={100} skipDelayDuration={300}>
  <TooltipPrimitive.Root bind:open disableCloseOnTriggerClick>
    <TooltipPrimitive.Trigger
      onpointerdown={(event: PointerEvent) => {
        touch = event.pointerType === "touch";
      }}
      onclick={() => {
        if (touch) open = !open;
      }}
    >
      {#snippet child({ props })}{@render trigger(props)}{/snippet}
    </TooltipPrimitive.Trigger>
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-hover-card
        {side}
        sideOffset={8}
        collisionPadding={8}
        class={cn(
          studioType,
          "z-50 w-64 max-w-[calc(100vw-16px)] space-y-2.5 rounded-surface bg-popover px-3 py-2.5 text-xs leading-4 text-popover-foreground shadow-edge-raised outline-hidden",
        )}>{@render children()}</TooltipPrimitive.Content
      >
    </TooltipPrimitive.Portal>
  </TooltipPrimitive.Root>
</TooltipProvider>
