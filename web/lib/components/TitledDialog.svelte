<script lang="ts">
  import type { Snippet } from "svelte";
  import Dialog from "../studio/Dialog.svelte";
  import DialogContent from "../studio/DialogContent.svelte";
  import DialogDescription from "../studio/DialogDescription.svelte";
  import DialogHeader from "../studio/DialogHeader.svelte";
  import DialogTitle from "../studio/DialogTitle.svelte";
  import { registerDialog } from "../studio/dialogController";
  import { cn } from "../studio/utils";
  import { studioType } from "./type";

  /** The Studio dialog with its title, optional description and a translated close button. */
  let {
    open = $bindable(false),
    title,
    description,
    children,
    closeLabel,
    onOpenChange,
    initialFocus,
    returnFocus,
    class: className,
  }: {
    open?: boolean;
    title: string;
    description?: string;
    children: Snippet;
    closeLabel: string;
    onOpenChange?: (open: boolean) => void;
    initialFocus?: () => HTMLElement | null;
    returnFocus?: () => HTMLElement | null;
    /** Extra classes for the content box, e.g. a fixed height. */
    class?: string;
  } = $props();
  $effect(() => {
    if (open)
      return registerDialog(() => {
        open = false;
        onOpenChange?.(false);
      });
  });
</script>

<Dialog bind:open {onOpenChange}>
  <DialogContent
    {closeLabel}
    preventScroll={false}
    preventOverflowTextSelection={false}
    onOpenAutoFocus={(event) => {
      const target = initialFocus?.();
      if (target) {
        event.preventDefault();
        target.focus();
      }
    }}
    onCloseAutoFocus={(event) => {
      const target = returnFocus?.();
      if (target?.isConnected) {
        event.preventDefault();
        target.focus();
      }
    }}
    class={cn(
      studioType,
      "flex max-h-[90dvh] flex-col overflow-auto text-sm text-foreground",
      className,
    )}
  >
    <DialogHeader class="pr-8">
      <DialogTitle>{title}</DialogTitle>
      {#if description}<DialogDescription>{description}</DialogDescription>{/if}
    </DialogHeader>
    {@render children()}
  </DialogContent>
</Dialog>
