<script lang="ts">
  import type { ComponentProps } from "svelte";
  import Button from "./Button.svelte";
  import Icon from "./Icon.svelte";
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
          class={cn("size-7", className)}
          onclick={(event) => {
            onclick?.(event);
            sidebar.toggleSidebar();
          }}
          {...rest}
        >
          <Icon icon="layout-left" />
          <span class="sr-only">Toggle Sidebar</span>
        </Button>
      {/snippet}
    </TooltipTrigger>
    <TooltipContent side="bottom" class="flex items-center gap-1.5">
      Collapse sidebar
      <span class="flex items-center gap-0.5">
        {#each KEYS as key (key)}
          <kbd
            class="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-sm border border-[#fff]/20 bg-[#fff]/10 text-[#fff]/70 text-xs font-mono"
            >{key}</kbd
          >
        {/each}
      </span>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
