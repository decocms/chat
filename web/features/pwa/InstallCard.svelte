<script lang="ts">
  import { onDestroy } from "svelte";
  import type { PwaService } from "./service";
  import { pwaText } from "./copy";
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Heading from "../../lib/ui/Heading.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import { X } from "../../lib/studio/icons";
  let {
    owner,
    lang,
    compact = false,
  }: {
    owner: PwaService;
    lang: string;
    /** One row (the phone home): the title, the install button and ×; the benefits stay out. */
    compact?: boolean;
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

{#if !$view.standalone && !$view.dismissed && $view.coarse && compact}
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
        }}><Icon icon={X} /></IconButton
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
  </section>{:else if !$view.standalone && !$view.dismissed && $view.coarse}
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
        }}><Icon icon={X} /></IconButton
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
