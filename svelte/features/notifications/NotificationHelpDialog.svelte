<script lang="ts">
  import { onDestroy } from "svelte";
  import type { PwaService } from "../pwa/service";
  import { pwaText, pwaPermission } from "../pwa/copy";
  import Dialog from "../../lib/ui/Dialog.svelte";
  import Button from "../../lib/ui/Button.svelte";
  /**
   * This device's notification settings and help: permission state, the
   * denied/iOS/unsupported explanations, mute, retry and a test push. Shared by
   * the account menu's notifications switch and the bell in account settings.
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
</script>

<Dialog
  bind:open
  title={text("settings")}
  closeLabel={text("close")}
  {returnFocus}
>
  <p class="tw:m-0">
    {text("permission")}: {pwaPermission(lang, $view.permission)}
  </p>
  {#if $view.iosWeb}<p class="tw:m-0 tw:leading-6">
      {text("ios")}
    </p>{:else if $view.permission === "denied"}<p class="tw:m-0 tw:leading-6">
      {text("denied")}
    </p>{:else if $view.permission === "unsupported"}<p class="tw:m-0">
      {text("unsupported")}
    </p>{:else if $view.permission === "default"}<Button
      onclick={(event) => {
        if (active && event.currentTarget.isConnected) void owner.bell();
      }}>{text("enable")}</Button
    >{/if}
  <label class="tw:flex tw:items-center tw:gap-2"
    ><input
      type="checkbox"
      checked={$view.muted}
      onchange={(event) => {
        if (current(event)) owner.mute(event.currentTarget.checked);
      }}
    />{text("mute")}</label
  >
  {#if $push.status === "working"}<p role="status" class="tw:m-0">
      {text("working")}
    </p>{/if}
  {#if $push.status === "unavailable"}<p role="status" class="tw:m-0">
      {text("unavailable")}
    </p>{/if}
  {#if $push.status === "unconfirmed"}<p
      role="alert"
      class="tw:m-0 tw:text-destructive"
    >
      {text("waiting")}
    </p>{:else if $push.error || ($view.error && $view.error !== "storage")}<p
      role="alert"
      class="tw:m-0 tw:text-destructive"
    >
      {text("failed")}
    </p>{/if}
  {#if $view.error === "storage"}<p role="alert" class="tw:m-0">
      {text("storage")}
    </p>{/if}
  <div class="tw:flex tw:flex-wrap tw:gap-2">
    <Button
      variant="outline"
      onclick={(event) => {
        if (current(event)) owner.retry();
      }}>{text("retry")}</Button
    ><Button
      variant="outline"
      loading={$view.testing}
      disabled={$view.permission !== "granted" ||
        $view.muted ||
        $push.status !== "on"}
      onclick={(event) => {
        if (current(event)) void owner.test();
      }}>{text("test")}</Button
    >
  </div>
  {#if $view.sent !== null}<p
      role="status"
      class="tw:m-0 tw:text-muted-foreground"
    >
      {text("sent", $view.sent)}
    </p>{/if}
  <details class="tw:space-y-2">
    <summary
      class="tw:cursor-pointer tw:rounded-control tw:focus-visible:outline-2 tw:focus-visible:outline-ring"
      >{text("steps")}</summary
    >
    <p class="tw:m-0 tw:leading-6">
      {$view.ios ? text("ios") : text("android")}
    </p>
  </details>
</Dialog>
