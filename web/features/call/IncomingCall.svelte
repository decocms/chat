<script lang="ts">
  import { onDestroy } from "svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { incomingRing, RING_REPEAT_MS } from "./ring";
  import { callHub, type CallHub } from "./hub";
  import { createCallApi } from "./callApi";
  /** A DM's call ringing me while I am elsewhere in the app (another room, Home): a small card in the corner, like a
   *  phone's. The DM itself shows the ring in its chat (CallLine), so the card is not there. */
  let {
    current,
    navigate,
    chime,
    t,
    hub = callHub(),
  }: {
    /** The room open now. */
    current: string | null;
    navigate(path: string): void;
    /** The app's chime (respects the Sound switch). */
    chime(): void;
    t(text: string, vars?: Record<string, string | number>): string;
    /** The app's calls (a test gives its own). */
    hub?: CallHub;
  } = $props();
  const ring = $derived(
    $incomingRing && $incomingRing.book !== current ? $incomingRing : null,
  );
  const api = createCallApi();
  let timer: ReturnType<typeof setTimeout> | undefined,
    sound: ReturnType<typeof setInterval> | undefined;
  // It rings until its time runs out (the server says stop too; this is for a lost notice), with the chime again
  // every few seconds.
  $effect(() => {
    const value = $incomingRing;
    clearTimeout(timer);
    if (!value) return;
    timer = setTimeout(
      () => incomingRing.update((r) => (r === value ? null : r)),
      Math.max(0, value.until - Date.now()),
    );
  });
  $effect(() => {
    clearInterval(sound);
    if (!ring) return;
    chime();
    sound = setInterval(chime, RING_REPEAT_MS);
    return () => clearInterval(sound);
  });
  onDestroy(() => {
    clearTimeout(timer);
    clearInterval(sound);
  });
  // `ring` follows the store: once the ring is cleared it is null, so each click reads it first (Atender used to
  // read it after clearing it, threw, and went nowhere, 2026-11-25).
  function answer() {
    const value = ring;
    if (!value) return;
    incomingRing.set(null);
    // Joined inside the click (the microphone wants the gesture), wherever I am; the DM's view, when it opens, shows
    // the call's stage.
    hub.session(value.book, { title: () => value.name }).join();
    hub.openStage(value.book);
    navigate(`/b/${value.book}`);
  }
  function decline() {
    const value = ring;
    if (!value) return;
    incomingRing.set(null);
    void api.decline(value.book).catch(() => {});
  }
</script>

{#if ring}<div
    data-incoming-call
    role="alertdialog"
    aria-label={t("{name} está ligando", { name: ring.name })}
    class="fixed top-4 right-4 z-[70] flex w-[min(20rem,calc(100vw-2rem))] items-center gap-3 rounded-xl bg-foreground py-3 pr-3 pl-3.5 font-sans text-sm text-background shadow-lg"
  >
    <PersonAvatar
      email={ring.from}
      version={ring.avatar}
      size="md"
      class="shrink-0 animate-pulse motion-reduce:animate-none"
    />
    <div class="min-w-0 flex-1">
      <p class="m-0 truncate font-medium">{ring.name}</p>
      <p class="m-0 truncate text-xs text-background/70">{t("Ligando…")}</p>
    </div>
    <IconButton
      data-ring-decline
      label={t("Recusar")}
      variant="destructive"
      class="size-10 shrink-0 rounded-full text-destructive-foreground hover:bg-destructive"
      onclick={decline}><Icon icon="phone-hang-up" size={18} /></IconButton
    >
    <IconButton
      data-ring-answer
      label={t("Atender")}
      variant="success"
      class="size-10 shrink-0 rounded-full"
      onclick={answer}><Icon icon="phone" size={18} /></IconButton
    >
  </div>{/if}
