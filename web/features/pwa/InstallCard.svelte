<script lang="ts">
  import { onDestroy } from "svelte";
  import type { PwaService } from "./service";
  import { pwaText } from "./copy";
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Heading from "../../lib/ui/Heading.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import { installOffer } from "./platform";
  let {
    owner,
    lang,
    compact = false,
    row = false,
  }: {
    owner: PwaService;
    lang: string;
    /** One row (the phone home): the title, the install button and ×; the benefits stay out. */
    compact?: boolean;
    /** A row of the phone's user center, like NotifyOffer's `row` (docs/design.md, "The user center"). */
    row?: boolean;
  } = $props();
  const view = $derived(owner.state);
  let active = true;
  onDestroy(() => {
    active = false;
  });
  const current = (event: Event) =>
    active &&
    event.currentTarget instanceof Element &&
    event.currentTarget.isConnected;
  const text = (key: Parameters<typeof pwaText>[1]) => pwaText(lang, key);
</script>

{#if installOffer($view) && row}<div
    data-install="row"
    role="region"
    aria-label={text("installRow")}
    class="group flex min-w-0 flex-col rounded-lg px-2.5 py-2 font-sans text-foreground hover:bg-sidebar-accent"
  >
    <div class="flex min-h-8 min-w-0 items-center gap-2.5">
      <img src="/icon-192.png" alt="" class="size-7 shrink-0 rounded-lg" /><span
        class="grid min-w-0 flex-1"
        ><span class="truncate text-sm font-medium">{text("installRow")}</span
        ><span class="truncate text-xs text-muted-foreground"
          >{text("installRowHint")}</span
        ></span
      ><IconButton
        label={text("close")}
        size="icon-xs"
        class="hidden group-focus-within:inline-flex group-hover:inline-flex [@media(hover:none)]:inline-flex"
        onclick={(event) => {
          if (current(event)) owner.dismissInstall();
        }}><Icon icon="x" /></IconButton
      >{#if !$view.ios || $view.safari}<Button
          size="xs"
          disabled={$view.installBusy}
          aria-busy={$view.installBusy || undefined}
          onclick={(event) => {
            if (current(event)) void owner.install();
          }}
          >{#if $view.installBusy}<Spinner size="xs" />{/if}{$view.canInstall
            ? text("installNow")
            : text("how")}</Button
        >{/if}
    </div>
    {#if $view.steps || ($view.ios && !$view.safari)}<p
        role="status"
        class="m-0 pt-1 pl-9.5 text-xs leading-5 text-muted-foreground"
      >
        {$view.ios ? text("ios") : text("android")}
      </p>{/if}
    {#if $view.error === "install"}<p
        role="alert"
        class="m-0 pt-1 pl-9.5 text-xs text-destructive"
      >
        {text("failed")}
      </p>{/if}
  </div>{:else if installOffer($view) && compact}
  <section
    data-install
    data-compact
    class="space-y-2 rounded-surface border border-border bg-card py-2 pr-2 pl-3 font-sans text-sm text-foreground"
  >
    <div class="flex items-center gap-3">
      <img src="/icon-192.png" alt="" class="size-8 rounded-lg" /><span
        class="min-w-0 flex-1 font-medium leading-5">{text("install")}</span
      >{#if !$view.ios || $view.safari}<Button
          size="sm"
          variant="outline"
          disabled={$view.installBusy}
          aria-busy={$view.installBusy || undefined}
          onclick={(event) => {
            if (current(event)) void owner.install();
          }}
          >{#if $view.installBusy}<Spinner size="xs" />{/if}{$view.canInstall
            ? text("installNow")
            : text("how")}</Button
        >{/if}<IconButton
        label={text("close")}
        onclick={(event) => {
          if (current(event)) owner.dismissInstall();
        }}><Icon icon="x" /></IconButton
      >
    </div>
    {#if $view.steps || ($view.ios && !$view.safari)}<p
        role="status"
        class="m-0 pr-1 leading-6 text-muted-foreground"
      >
        {$view.ios ? text("ios") : text("android")}
      </p>{/if}
    {#if $view.error === "install"}<p role="alert" class="m-0 text-destructive">
        {text("failed")}
      </p>{/if}
  </section>{:else if installOffer($view)}
  <section
    data-install
    class="mb-4 space-y-3 rounded-surface border border-border bg-card p-4 font-sans text-sm text-foreground"
  >
    <div class="flex items-center gap-3">
      <img src="/icon-192.png" alt="" class="size-10 rounded-control" /><Heading
        class="flex-1 text-lg">{text("install")}</Heading
      ><IconButton
        label={text("close")}
        onclick={(event) => {
          if (current(event)) owner.dismissInstall();
        }}><Icon icon="x" /></IconButton
      >
    </div>
    <p class="m-0 text-muted-foreground">{text("benefits")}</p>
    {#if !$view.ios || $view.safari}<Button
        disabled={$view.installBusy}
        aria-busy={$view.installBusy || undefined}
        onclick={(event) => {
          if (current(event)) void owner.install();
        }}
        >{#if $view.installBusy}<Spinner size="xs" />{/if}{$view.canInstall
          ? text("installNow")
          : text("how")}</Button
      >{/if}
    {#if $view.steps || ($view.ios && !$view.safari)}<p
        role="status"
        class="m-0 leading-6"
      >
        {$view.ios ? text("ios") : text("android")}
      </p>{/if}
    {#if $view.error === "install"}<p role="alert" class="text-destructive">
        {text("failed")}
      </p>{/if}
  </section>{/if}
