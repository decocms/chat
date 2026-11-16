<script lang="ts">
  import type { Snippet } from "svelte";
  import Tooltip from "../studio/Tooltip.svelte";
  import TooltipContent from "../studio/TooltipContent.svelte";
  import TooltipTrigger from "../studio/TooltipTrigger.svelte";

  /** A Studio tooltip that a tap also toggles on touch screens, where a tooltip alone never opens; only for triggers whose tap does nothing else. */
  let {
    label,
    side = "top",
    trigger,
  }: {
    label: string;
    side?: "top" | "right" | "bottom" | "left";
    trigger: Snippet<[Record<string, unknown>]>;
  } = $props();
  let open = $state(false),
    touch = false;
</script>

<Tooltip bind:open disableCloseOnTriggerClick>
  <TooltipTrigger
    onpointerdown={(event: PointerEvent) => {
      touch = event.pointerType === "touch";
    }}
    onclick={() => {
      if (touch) open = !open;
    }}
  >
    {#snippet child({ props })}{@render trigger(props)}{/snippet}
  </TooltipTrigger>
  <TooltipContent {side} sideOffset={4}>{label}</TooltipContent>
</Tooltip>
