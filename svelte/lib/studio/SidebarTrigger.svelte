<script lang="ts">
  import type { ComponentProps } from "svelte";
  import Button from "./Button.svelte";
  import Icon from "./Icon.svelte";
  import { LayoutLeft } from "./icons";
  import { useSidebar } from "./sidebar";
  import Tooltip from "./Tooltip.svelte";
  import TooltipContent from "./TooltipContent.svelte";
  import TooltipProvider from "./TooltipProvider.svelte";
  import TooltipTrigger from "./TooltipTrigger.svelte";
  import { cn } from "./utils";

  /** Collapses or expands the sidebar; on a phone it opens the sheet. */
  let {
    class: className,
    onclick,
    ref = $bindable(null),
    ...rest
  }: Omit<ComponentProps<typeof Button>, "children"> = $props();

  const sidebar = useSidebar();
  const KEYS = ["⌘", "B"];
</script>

<TooltipProvider delayDuration={300}>
  <Tooltip>
    <TooltipTrigger>
      {#snippet child({ props })}
        <Button
          bind:ref
          {...props}
          data-sidebar="trigger"
          data-slot="sidebar-trigger"
          variant="ghost"
          size="icon"
          class={cn("tw:size-7", className)}
          onclick={(event) => {
            onclick?.(event);
            sidebar.toggleSidebar();
          }}
          {...rest}
        >
          <Icon icon={LayoutLeft} />
          <span class="tw:sr-only">Toggle Sidebar</span>
        </Button>
      {/snippet}
    </TooltipTrigger>
    <TooltipContent side="bottom" class="tw:flex tw:items-center tw:gap-1.5">
      Collapse sidebar
      <span class="tw:flex tw:items-center tw:gap-0.5">
        {#each KEYS as key (key)}
          <kbd
            class="tw:inline-flex tw:items-center tw:justify-center tw:min-w-5 tw:h-5 tw:px-1 tw:rounded-sm tw:border tw:border-[#fff]/20 tw:bg-[#fff]/10 tw:text-[#fff]/70 tw:text-xs tw:font-mono"
            >{key}</kbd
          >
        {/each}
      </span>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
