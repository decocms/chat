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
      class="tw:bg-sidebar tw:text-sidebar-foreground tw:w-(--sidebar-width) tw:p-0 tw:[--sidebar-width:18rem] tw:[&>button]:hidden"
      {side}
    >
      <SheetHeader class="tw:sr-only">
        <SheetTitle>Sidebar</SheetTitle>
        <SheetDescription>Displays the mobile sidebar.</SheetDescription>
      </SheetHeader>
      <div class="tw:flex tw:h-full tw:w-full tw:flex-col">
        {@render children?.()}
      </div>
    </SheetContent>
  </Sheet>
{:else}
  <div
    class={cn(
      "tw:group/sidebar tw:peer tw:text-sidebar-foreground tw:hidden tw:md:flex tw:flex-col tw:shrink-0 tw:overflow-hidden",
      "tw:transition-[width] tw:duration-150 tw:ease-out tw:motion-reduce:transition-none",
      isExpanded ? "tw:w-(--sidebar-width)" : "tw:w-(--sidebar-width-icon)",
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
        "tw:flex tw:flex-col tw:h-full tw:transition-[width] tw:duration-150 tw:ease-out tw:motion-reduce:transition-none",
        isExpanded ? "tw:w-(--sidebar-width)" : "tw:w-(--sidebar-width-icon)",
        className,
      )}
    >
      <div
        data-sidebar="sidebar"
        data-slot="sidebar-inner"
        class="tw:bg-sidebar tw:flex tw:h-full tw:w-full tw:flex-col"
      >
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}
