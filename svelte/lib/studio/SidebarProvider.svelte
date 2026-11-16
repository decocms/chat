<script lang="ts">
  import type { Snippet } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { setSidebarContext, SIDEBAR_MOBILE_QUERY } from "./sidebar";
  import TooltipProvider from "./TooltipProvider.svelte";

  /** Holds whether the sidebar is open. Pass `open` (or `bind:open`) to control it; otherwise it starts from `defaultOpen`. */
  let {
    children,
    defaultOpen = false,
    open = $bindable(),
    onOpenChange,
  }: {
    children?: Snippet;
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  } = $props();

  const mobile = new MediaQuery(SIDEBAR_MOBILE_QUERY);
  // svelte-ignore state_referenced_locally
  let internalOpen = $state(defaultOpen);
  let openMobile = $state(false);
  const current = $derived(open ?? internalOpen);

  function setOpen(next: boolean) {
    if (open === undefined) internalOpen = next;
    else open = next;
    onOpenChange?.(next);
  }

  setSidebarContext({
    get state() {
      return current ? ("expanded" as const) : ("collapsed" as const);
    },
    get open() {
      return current;
    },
    setOpen,
    get isMobile() {
      return mobile.current;
    },
    get openMobile() {
      return openMobile;
    },
    setOpenMobile(next) {
      openMobile = next;
    },
    toggleSidebar() {
      if (mobile.current) openMobile = !openMobile;
      else setOpen(!current);
    },
  });
</script>

<TooltipProvider delayDuration={0}>{@render children?.()}</TooltipProvider>
