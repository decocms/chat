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
    data-vb-native
    data-native-install
    data-compact
    class="tw:space-y-2 tw:rounded-surface tw:border tw:border-border tw:bg-card tw:py-2 tw:pr-2 tw:pl-3 tw:font-sans tw:text-sm tw:text-foreground"
  >
    <div class="tw:flex tw:items-center tw:gap-3">
      <img src="/icon-192.png" alt="" class="tw:size-8 tw:rounded-lg" /><span
        class="tw:min-w-0 tw:flex-1 tw:font-medium tw:leading-5"
        >{text("install")}</span
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
        class="tw:m-0 tw:pr-1 tw:leading-6 tw:text-muted-foreground"
      >
        {$view.ios ? text("ios") : text("android")}
      </p>{/if}
    {#if $view.error === "install"}<p
        role="alert"
        class="tw:m-0 tw:text-destructive"
      >
        {text("failed")}
      </p>{/if}
  </section>{:else if !$view.standalone && !$view.dismissed && $view.coarse}
  <section
    data-vb-native
    data-native-install
    class="tw:mb-4 tw:space-y-3 tw:rounded-surface tw:border tw:border-border tw:bg-card tw:p-4 tw:font-sans tw:text-sm tw:text-foreground"
  >
    <div class="tw:flex tw:items-center tw:gap-3">
      <img
        src="/icon-192.png"
        alt=""
        class="tw:size-10 tw:rounded-control"
      /><Heading class="tw:flex-1 tw:text-lg">{text("install")}</Heading
      ><IconButton
        label={text("close")}
        onclick={(event) => {
          if (current(event)) owner.dismissInstall();
        }}><Icon icon={X} /></IconButton
      >
    </div>
    <p class="tw:m-0 tw:text-muted-foreground">{text("benefits")}</p>
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
        class="tw:m-0 tw:leading-6"
      >
        {$view.ios ? text("ios") : text("android")}
      </p>{/if}
    {#if $view.error === "install"}<p role="alert" class="tw:text-destructive">
        {text("failed")}
      </p>{/if}
  </section>{/if}
