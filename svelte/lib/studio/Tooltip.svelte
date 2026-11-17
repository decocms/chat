<script lang="ts">
  import { Tooltip as TooltipPrimitive } from "bits-ui";
  import { getContext } from "svelte";
  import TooltipProvider from "./TooltipProvider.svelte";
  import { TOOLTIP_PROVIDER } from "./tooltip";

  /** Ported from @decocms/ui `Tooltip`: works anywhere. Inside a TooltipProvider it joins it (one open at a time across a toolbar); alone it brings its own. Label tooltips aren't hoverable: leaving the trigger closes them at once. */
  let { open = $bindable(false), ...rest }: TooltipPrimitive.RootProps =
    $props();
  const shared = getContext<boolean>(TOOLTIP_PROVIDER) === true;
</script>

{#if shared}<TooltipPrimitive.Root
    bind:open
    disableHoverableContent
    {...rest}
  />{:else}<TooltipProvider disableHoverableContent>
    <TooltipPrimitive.Root bind:open {...rest} />
  </TooltipProvider>{/if}
