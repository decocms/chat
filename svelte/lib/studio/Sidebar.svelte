<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import Sheet from "./Sheet.svelte";
  import SheetContent from "./SheetContent.svelte";
  import SheetDescription from "./SheetDescription.svelte";
  import SheetHeader from "./SheetHeader.svelte";
  import SheetTitle from "./SheetTitle.svelte";
  import { useSidebar } from "./sidebar";
  import { cn } from "./utils";

  /** The rail itself: a column that narrows to icons when collapsed, and a sheet on a phone. */
  let {
    side = "left",
    variant = "sidebar",
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLAttributes<HTMLDivElement>, "style" | "class" | "children"> & {
    side?: "left" | "right";
    variant?: "sidebar" | "floating" | "inset";
    class?: string;
    ref?: HTMLDivElement | null;
    children?: Snippet;
  } = $props();

  const sidebar = useSidebar();
  const isExpanded = $derived(sidebar.state === "expanded");
</script>

{#if sidebar.isMobile}
  <Sheet bind:open={() => sidebar.openMobile, sidebar.setOpenMobile}>
    <SheetContent
      data-sidebar="sidebar"
      data-slot="sidebar"
      data-mobile="true"
      class="bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [--sidebar-width:18rem] [&>button]:hidden"
      {side}
    >
      <SheetHeader class="sr-only">
        <SheetTitle>Sidebar</SheetTitle>
        <SheetDescription>Displays the mobile sidebar.</SheetDescription>
      </SheetHeader>
      <div class="flex h-full w-full flex-col">
        {@render children?.()}
      </div>
    </SheetContent>
  </Sheet>
{:else}
  <div
    class={cn(
      "group/sidebar peer text-sidebar-foreground hidden md:flex flex-col shrink-0 overflow-hidden",
      "transition-[width] duration-150 ease-out motion-reduce:transition-none",
      isExpanded ? "w-(--sidebar-width)" : "w-(--sidebar-width-icon)",
    )}
    data-state={sidebar.state}
    data-collapsible={isExpanded ? undefined : "icon"}
    data-variant={variant}
    data-side={side}
    data-slot="sidebar"
  >
    <div
      bind:this={ref}
      data-slot="sidebar-container"
      {...rest}
      class={cn(
        "flex flex-col h-full transition-[width] duration-150 ease-out motion-reduce:transition-none",
        isExpanded ? "w-(--sidebar-width)" : "w-(--sidebar-width-icon)",
        className,
      )}
    >
      <div
        data-sidebar="sidebar"
        data-slot="sidebar-inner"
        class="bg-sidebar flex h-full w-full flex-col"
      >
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}
