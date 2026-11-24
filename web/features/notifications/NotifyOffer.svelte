<script lang="ts">
  import { onDestroy } from "svelte";
  import type { PwaService } from "../pwa/service";
  import { pwaText } from "../pwa/copy";
  import { notificationOffer } from "./device";
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  /**
   * The one notifications offer of a device (Gimenes #4354, #4363): a row at
   * the top of Home and of a room. "Ativar" opens the browser's prompt; × hides
   * it for good on this device. The first send asks too (see offerOnSend).
   */
  let {
    owner,
    lang,
    card = false,
  }: {
    owner: PwaService;
    lang: string;
    /** Home: a rounded card in the list. A room: a full-width row under the bar. */
    card?: boolean;
  } = $props();
  const view = $derived(owner.state);
  let active = true;
  onDestroy(() => {
    active = false;
  });
  const text = (key: Parameters<typeof pwaText>[1]) => pwaText(lang, key);
  const live = (event: Event) =>
    active &&
    event.currentTarget instanceof Element &&
    event.currentTarget.isConnected;
</script>

{#if notificationOffer($view)}<div
    data-notify-offer
    role="region"
    aria-label={text("notifications")}
    class={[
      "flex items-center gap-2 py-1.5 pr-1.5 pl-4 font-sans text-sm text-foreground",
      card
        ? "mb-2 rounded-surface border border-border bg-card"
        : "border-b border-border bg-muted",
    ]}
  >
    <Icon icon="bell-01" size={16} /><span class="min-w-0 flex-1 leading-5"
      >{text("offer")}</span
    ><Button
      size="sm"
      variant="outline"
      onclick={(event) => {
        if (live(event)) owner.askNotifications();
      }}>{text("offerOn")}</Button
    ><IconButton
      label={text("close")}
      onclick={(event) => {
        if (live(event)) owner.skipNotifications();
      }}><Icon icon="x" /></IconButton
    >
  </div>{/if}
