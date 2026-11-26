<script lang="ts">
  import { onDestroy } from "svelte";
  import type { PwaService } from "../pwa/service";
  import { pwaText } from "../pwa/copy";
  import { notificationOffer } from "./device";
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  /**
   * The one notifications offer of a device (Gimenes #4354, #4363). "Ativar"
   * opens the browser's prompt; × hides it for good on this device. The first
   * send asks too (see offerOnSend). It is a row of the user center (`row`,
   * Gimenes #5064): the sidebar's on desktop, the Chats list's on a phone. Else
   * it is a card: the top of a phone's Home with no conversation yet.
   */
  let {
    owner,
    lang,
    row = false,
  }: {
    owner: PwaService;
    lang: string;
    /** The user center: one row like "Your agent" (docs/design.md, "The user center"). */
    row?: boolean;
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

{#if notificationOffer($view) && row}<div
    data-notify-offer="row"
    role="region"
    aria-label={text("notifications")}
    class="group flex min-h-12 min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 font-sans text-foreground hover:bg-sidebar-accent"
  >
    <span
      aria-hidden="true"
      class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-muted-foreground"
      ><Icon icon="bell-01" size={16} /></span
    ><span class="grid min-w-0 flex-1"
      ><span class="truncate text-sm font-medium">{text("notifications")}</span
      ><span class="truncate text-xs text-muted-foreground"
        >{text("offerOff")}</span
      ></span
    ><IconButton
      label={text("offerLater")}
      size="icon-xs"
      class="hidden group-hover:inline-flex group-focus-within:inline-flex [@media(hover:none)]:inline-flex"
      onclick={(event) => {
        if (live(event)) owner.skipNotifications();
      }}><Icon icon="x" /></IconButton
    ><Button
      size="xs"
      onclick={(event) => {
        if (live(event)) owner.askNotifications();
      }}>{text("offerOn")}</Button
    >
  </div>{:else if notificationOffer($view)}<div
    data-notify-offer
    role="region"
    aria-label={text("notifications")}
    class="mb-2 flex items-center gap-2 rounded-surface border border-border bg-card py-1.5 pr-1.5 pl-4 font-sans text-sm text-foreground"
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
