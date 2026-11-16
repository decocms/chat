<script lang="ts">
  import AlertDialog from "../studio/AlertDialog.svelte";
  import AlertDialogAction from "../studio/AlertDialogAction.svelte";
  import AlertDialogCancel from "../studio/AlertDialogCancel.svelte";
  import AlertDialogContent from "../studio/AlertDialogContent.svelte";
  import AlertDialogDescription from "../studio/AlertDialogDescription.svelte";
  import AlertDialogFooter from "../studio/AlertDialogFooter.svelte";
  import AlertDialogHeader from "../studio/AlertDialogHeader.svelte";
  import AlertDialogTitle from "../studio/AlertDialogTitle.svelte";
  import Spinner from "../studio/Spinner.svelte";
  import { registerDialog } from "../studio/dialogController";
  import { cn } from "../studio/utils";
  import { studioType } from "./type";

  /** A destructive confirmation on the Studio alert dialog: Cancel takes focus, the action stays open until the caller closes it. */
  let {
    open = $bindable(false),
    title,
    description,
    confirmLabel,
    cancelLabel,
    busy = false,
    confirmDisabled = false,
    error = "",
    onconfirm,
    onOpenChange,
    returnFocus,
  }: {
    open?: boolean;
    title: string;
    description?: string;
    confirmLabel: string;
    cancelLabel: string;
    busy?: boolean;
    confirmDisabled?: boolean;
    error?: string;
    onconfirm: () => void;
    onOpenChange?: (open: boolean) => void;
    returnFocus?: () => HTMLElement | null;
  } = $props();
  let cancelButton = $state<HTMLElement | null>(null);
  $effect(() => {
    if (open)
      return registerDialog(() => {
        open = false;
        onOpenChange?.(false);
      });
  });
</script>

<AlertDialog bind:open {onOpenChange}>
  <AlertDialogContent
    data-vb-native
    class={cn(studioType, "tw:text-sm tw:text-foreground")}
    preventScroll={false}
    preventBodyPointerEvents={false}
    preventOverflowTextSelection={false}
    onOpenAutoFocus={(event) => {
      event.preventDefault();
      cancelButton?.focus();
    }}
    onCloseAutoFocus={(event) => {
      const target = returnFocus?.();
      if (target?.isConnected) {
        event.preventDefault();
        target.focus();
      }
    }}
    onEscapeKeydown={(event) => {
      if (busy) event.preventDefault();
    }}
  >
    <AlertDialogHeader>
      <AlertDialogTitle>{title}</AlertDialogTitle>
      {#if description}<AlertDialogDescription
          class="tw:whitespace-pre-wrap tw:break-words"
          >{description}</AlertDialogDescription
        >{/if}
    </AlertDialogHeader>
    {#if error}<p role="alert" class="tw:m-0 tw:text-sm tw:text-destructive">
        {error}
      </p>{/if}
    <AlertDialogFooter>
      <AlertDialogCancel bind:ref={cancelButton} disabled={busy}
        >{cancelLabel}</AlertDialogCancel
      >
      <AlertDialogAction
        variant="destructive"
        disabled={busy || confirmDisabled}
        aria-busy={busy || undefined}
        onclick={(event) => {
          event.preventDefault();
          onconfirm();
        }}
        >{#if busy}<Spinner size="xs" />{/if}{confirmLabel}</AlertDialogAction
      >
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
