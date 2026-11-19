<script lang="ts">
  import { onDestroy } from "svelte";
  import type { PwaService } from "../pwa/service";
  import { pwaText, pwaPermission } from "../pwa/copy";
  import Dialog from "../../lib/studio/Dialog.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Checkbox from "../../lib/studio/Checkbox.svelte";
  import DialogContent from "../../lib/studio/DialogContent.svelte";
  import DialogHeader from "../../lib/studio/DialogHeader.svelte";
  import DialogTitle from "../../lib/studio/DialogTitle.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import { registerDialog } from "../../lib/studio/dialogController";
  /**
   * This device's notification settings and help: permission state, the
   * denied/iOS/unsupported explanations, mute, retry and a test push. Shared by
   * the notifications switch on the settings page.
   */
  let {
    owner,
    lang,
    open = $bindable(false),
    returnFocus,
  }: {
    owner: PwaService;
    lang: string;
    open?: boolean;
    /** Where focus goes when the dialog closes (default: where it was before). */
    returnFocus?: () => HTMLElement | null;
  } = $props();
  const view = $derived(owner.state),
    push = $derived(owner.push);
  let active = true;
  onDestroy(() => {
    active = false;
  });
  const current = (event: Event) =>
    active &&
    event.currentTarget instanceof Element &&
    event.currentTarget.isConnected;
  const text = (key: Parameters<typeof pwaText>[1], n?: number) =>
    pwaText(lang, key, n);
  $effect(() => {
    if (open)
      return registerDialog(() => {
        open = false;
      });
  });
</script>

<Dialog bind:open>
  <DialogContent
    class="max-h-[90dvh] overflow-auto font-sans text-sm text-foreground"
    closeLabel={text("close")}
    preventScroll={false}
    preventBodyPointerEvents={false}
    preventOverflowTextSelection={false}
    onCloseAutoFocus={(event) => {
      const target = returnFocus?.();
      if (target?.isConnected) {
        event.preventDefault();
        target.focus();
      }
    }}
  >
    <DialogHeader class="pr-8">
      <DialogTitle class="font-sans">{text("settings")}</DialogTitle>
    </DialogHeader>
    <p class="m-0">
      {text("permission")}: {pwaPermission(lang, $view.permission)}
    </p>
    {#if $view.iosWeb}<p class="m-0 leading-6">
        {text("ios")}
      </p>{:else if $view.permission === "denied"}<p class="m-0 leading-6">
        {text("denied")}
      </p>{:else if $view.permission === "unsupported"}<p class="m-0">
        {text("unsupported")}
      </p>{:else if $view.permission === "default"}<Button
        onclick={(event) => {
          if (active && event.currentTarget.isConnected) void owner.bell();
        }}>{text("enable")}</Button
      >{/if}
    <label class="flex items-center gap-2"
      ><Checkbox
        bind:checked={
          () => $view.muted,
          (checked) => {
            if (active) owner.mute(checked);
          }
        }
      />{text("mute")}</label
    >
    {#if $push.status === "working"}<p role="status" class="m-0">
        {text("working")}
      </p>{/if}
    {#if $push.status === "unavailable"}<p role="status" class="m-0">
        {text("unavailable")}
      </p>{/if}
    {#if $push.status === "unconfirmed"}<p
        role="alert"
        class="m-0 text-destructive"
      >
        {text("waiting")}
      </p>{:else if $push.error || ($view.error && $view.error !== "storage")}<p
        role="alert"
        class="m-0 text-destructive"
      >
        {text("failed")}
      </p>{/if}
    {#if $view.error === "storage"}<p role="alert" class="m-0">
        {text("storage")}
      </p>{/if}
    <div class="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onclick={(event) => {
          if (current(event)) owner.retry();
        }}>{text("retry")}</Button
      ><Button
        variant="outline"
        aria-busy={$view.testing || undefined}
        disabled={$view.testing ||
          $view.permission !== "granted" ||
          $view.muted ||
          $push.status !== "on"}
        onclick={(event) => {
          if (current(event)) void owner.test();
        }}
        >{#if $view.testing}<Spinner size="xs" />{/if}{text("test")}</Button
      >
    </div>
    {#if $view.sent !== null}<p role="status" class="m-0 text-muted-foreground">
        {text("sent", $view.sent)}
      </p>{/if}
    <details class="space-y-2">
      <summary
        class="cursor-pointer rounded-control focus-visible:outline-2 focus-visible:outline-ring"
        >{text("steps")}</summary
      >
      <p class="m-0 leading-6">
        {$view.ios ? text("ios") : text("android")}
      </p>
    </details>
  </DialogContent>
</Dialog>
