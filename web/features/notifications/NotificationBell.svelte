<script lang="ts">
  import { onDestroy } from "svelte";
  import type { PwaService } from "../pwa/service";
  import { pwaText } from "../pwa/copy";
  import NotificationHelpDialog from "./NotificationHelpDialog.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import { Bell01, BellOff01, DotsHorizontal } from "../../lib/studio/icons";
  let { owner, lang }: { owner: PwaService; lang: string } = $props();
  const view = $derived(owner.state);
  let open = $state(false),
    active = true;
  onDestroy(() => {
    active = false;
  });
  const current = (event: Event) =>
    active &&
    event.currentTarget instanceof Element &&
    event.currentTarget.isConnected;
  const text = (key: Parameters<typeof pwaText>[1], n?: number) =>
    pwaText(lang, key, n);
  const label = $derived(
    $view.permission === "granted"
      ? text($view.muted ? "off" : "on")
      : text("enable"),
  );
</script>

<span
  data-notifications
  class="inline-flex items-center gap-1 font-sans text-sm text-foreground"
>
  <IconButton
    {label}
    tooltipSide="bottom"
    onclick={(event) => {
      if (!active || !event.currentTarget.isConnected) return;
      void owner.bell().then((success) => {
        if (active && !success) open = true;
      });
    }}><Icon icon={$view.muted ? BellOff01 : Bell01} /></IconButton
  >
  <IconButton
    label={text("help")}
    tooltipSide="bottom"
    onclick={(event) => {
      if (!current(event)) return;
      open = true;
      void owner.refresh();
    }}><Icon icon={DotsHorizontal} /></IconButton
  >
</span>
<NotificationHelpDialog bind:open {owner} {lang} />
