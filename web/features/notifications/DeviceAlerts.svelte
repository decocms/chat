<script lang="ts">
  import { onDestroy } from "svelte";
  import type { PwaService } from "../pwa/service";
  import { pwaText } from "../pwa/copy";
  import { notificationAvailability } from "./device";
  import Button from "../../lib/studio/Button.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import Switch from "../../lib/studio/Switch.svelte";
  /**
   * The two alert rows of "This device" on /settings, in the card style of the
   * other rows: Notifications (push to this device, off until the person turns it on; a device that never chose gets one offer, see NotifyOffer) and Sound
   * (the in-app chime, on by default). Each switch is independent.
   */
  let {
    owner,
    lang,
    row,
    hint,
  }: {
    owner: PwaService;
    lang: string;
    /** The settings card's row and hint classes. */
    row: string;
    hint: string;
  } = $props();
  const view = $derived(owner.state),
    push = $derived(owner.push);
  let active = true;
  onDestroy(() => {
    active = false;
  });
  const text = (key: Parameters<typeof pwaText>[1]) => pwaText(lang, key);
  const availability = $derived(notificationAvailability($view));
  const ready = $derived(availability === "ready");
  const on = $derived(ready && $view.notifications);
  const failed = $derived(
    on &&
      !$view.enabling &&
      ($view.error === "enable" || $push.status === "failed"),
  );
</script>

<div data-notifications class={row}>
  <div class="flex min-w-0 flex-1 basis-0 flex-col gap-0.5">
    <label for="settings-notifications" class={ready ? "cursor-pointer" : ""}
      >{text("notifications")}</label
    >
    {#if availability === "denied"}<p
        id="settings-notifications-hint"
        class={hint}
      >
        {text("denied")}
      </p>
      <details class="text-xs leading-4 text-muted-foreground">
        <summary
          class="cursor-pointer rounded-control text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >{text("howAllow")}</summary
        >
        <p class="m-0 mt-1">{text("allowSteps")}</p>
      </details>{:else if availability === "ios"}<p
        id="settings-notifications-hint"
        class={hint}
      >
        {text("iosHint")}
      </p>
      <details class="text-xs leading-4 text-muted-foreground">
        <summary
          class="cursor-pointer rounded-control text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >{text("how")}</summary
        >
        <p class="m-0 mt-1">{text("ios")}</p>
      </details>{:else if availability === "unsupported"}<p
        id="settings-notifications-hint"
        class={hint}
      >
        {text("unsupported")}
      </p>{:else}<p id="settings-notifications-hint" class={hint}>
        {text("notificationsHint")}
      </p>{/if}
    {#if $view.enabling}<p
        role="status"
        class="m-0 flex items-center gap-1.5 text-xs leading-4 text-muted-foreground"
      >
        <Spinner size="xs" />{text("enabling")}
      </p>{:else if failed}<div
        role="alert"
        class="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1 text-xs leading-4 text-destructive"
      >
        <span>{text("enableFailed")}</span><Button
          variant="outline"
          size="sm"
          onclick={(event) => {
            if (active && event.currentTarget.isConnected) owner.retry();
          }}>{text("tryAgain")}</Button
        >
      </div>{:else if on && $push.status === "unavailable"}<p
        role="status"
        class={hint}
      >
        {text("unavailable")}
      </p>{/if}
  </div>
  <Switch
    id="settings-notifications"
    aria-describedby="settings-notifications-hint"
    bind:checked={
      () => on || $view.enabling,
      (wanted) => {
        if (active) void owner.setNotifications(wanted);
      }
    }
    disabled={!ready || $view.enabling}
  />
</div>
<div class={row}>
  <div class="flex min-w-0 flex-1 basis-0 flex-col gap-0.5">
    <label for="settings-sound" class="cursor-pointer">{text("sound")}</label>
    <p id="settings-sound-hint" class={hint}>{text("soundHint")}</p>
    {#if $view.error === "storage"}<p role="alert" class={hint}>
        {text("storage")}
      </p>{/if}
  </div>
  <Switch
    id="settings-sound"
    data-sound
    aria-describedby="settings-sound-hint"
    bind:checked={
      () => $view.sound,
      (wanted) => {
        if (active) owner.setSound(wanted);
      }
    }
  />
</div>
