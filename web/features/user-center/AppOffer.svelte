<script lang="ts">
  import { onDestroy } from "svelte";
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  /**
   * "Instale o app", a notice of the user center on desktop (Gimenes #5843):
   * it shows while none of your computers runs the deco.chat menu bar app
   * (`installed` false; null = not known yet, no row). On macOS and Linux,
   * Copiar copies the one line that installs it (setup.sh) and the row says
   * where to paste it. On Windows, Baixar opens the releases, where the .msi
   * is. × hides it on this browser for 14 days. The row goes away by itself
   * when the app's runner checks in (the next read of /api/me/app).
   */
  let {
    installed,
    lang,
    origin = location.origin,
  }: {
    installed: boolean | null;
    lang: "pt" | "en";
    origin?: string;
  } = $props();
  const KEY = "vb.appOffer.hidden",
    HIDE = 14 * 864e5;
  const RELEASES = "https://github.com/decocms/chat/releases";
  const en = $derived(lang === "en");
  const windows = /^win|windows/i.test(
    navigator.platform || navigator.userAgent,
  );
  const command = $derived(`curl -fsSL ${origin}/setup.sh | sh`);
  function hiddenAt() {
    try {
      return Number(localStorage.getItem(KEY)) || 0;
    } catch {
      return 0;
    }
  }
  let hidden = $state(Date.now() - hiddenAt() < HIDE),
    copied = $state<"" | "ok" | "failed">("");
  let active = true;
  onDestroy(() => {
    active = false;
  });
  function hide() {
    hidden = true;
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      if (active) copied = "ok";
    } catch {
      if (active) copied = "failed";
    }
  }
  const line = $derived(
    copied === "ok"
      ? en
        ? "Copied: paste it in the Terminal"
        : "Copiado: cole no Terminal"
      : copied === "failed"
        ? command
        : en
          ? "Claude always on"
          : "Seu Claude ligado",
  );
</script>

{#if installed === false && !hidden}<div
    data-app-offer
    role="region"
    aria-label={en ? "Install the app" : "Instale o app"}
    class="group flex min-h-12 min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 font-sans text-foreground hover:bg-sidebar-accent"
  >
    <span
      aria-hidden="true"
      class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-muted-foreground"
      ><Icon icon="app-laptop" size={16} /></span
    ><span class="grid min-w-0 flex-1"
      ><span class="truncate text-sm font-medium"
        >{en ? "Install the app" : "Instale o app"}</span
      ><span
        class={[
          "truncate text-xs text-muted-foreground",
          copied === "failed" && "select-all font-mono",
        ]}
        title={line}>{line}</span
      ></span
    ><IconButton
      label={en ? "Not now" : "Agora não"}
      size="icon-xs"
      class="hidden group-hover:inline-flex group-focus-within:inline-flex [@media(hover:none)]:inline-flex"
      onclick={(event) => {
        if (event.currentTarget.isConnected) hide();
      }}><Icon icon="x" /></IconButton
    >{#if windows}<Button
        size="xs"
        href={RELEASES}
        target="_blank"
        rel="noopener noreferrer">{en ? "Download" : "Baixar"}</Button
      >{:else}<Button
        size="xs"
        onclick={(event) => {
          if (event.currentTarget.isConnected) void copy();
        }}>{en ? "Copy" : "Copiar"}</Button
      >{/if}
  </div>{/if}
