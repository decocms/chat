<script lang="ts">
  import { onDestroy } from "svelte";
  import type { PwaService } from "../pwa/service";
  import { pwaText } from "../pwa/copy";
  import NotificationHelpDialog from "./NotificationHelpDialog.svelte";
  import Button from "../../lib/ui/Button.svelte";
  import Icon from "../../lib/ui/Icon.svelte";
  import Tip from "../../lib/ui/Tip.svelte";
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

{#snippet bell(tip: Record<string, unknown>)}
  <Button
    {...tip}
    variant="ghost"
    size="sm"
    aria-label={label}
    onclick={(event) => {
      if (!active || !event.currentTarget.isConnected) return;
      void owner.bell().then((success) => {
        if (active && !success) open = true;
      });
    }}><Icon name={$view.muted ? "bellOff" : "bell"} /></Button
  >
{/snippet}
{#snippet more(tip: Record<string, unknown>)}
  <Button
    {...tip}
    variant="ghost"
    size="sm"
    aria-label={text("help")}
    onclick={(event) => {
      if (!current(event)) return;
      open = true;
      void owner.refresh();
    }}>⋯</Button
  >
{/snippet}

<span
  data-vb-native
  data-native-notifications
  class="tw:inline-flex tw:items-center tw:gap-1 tw:font-sans tw:text-sm tw:text-foreground"
>
  <Tip {label} side="bottom" trigger={bell} />
  <Tip label={text("help")} side="bottom" trigger={more} />
</span>
<NotificationHelpDialog bind:open {owner} {lang} />
