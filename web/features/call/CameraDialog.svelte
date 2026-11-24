<script lang="ts" module>
  import type { Blur } from "./blur";
  // The level the person chose last, for the next time they turn the camera on in this tab.
  let lastLevel: Blur = "none";
</script>

<script lang="ts">
  import TitledDialog from "../../lib/components/TitledDialog.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import { CAM_CAPTURE } from "./session";
  /** Before the camera goes to the call: the person sees the picture that the others will get, chooses how much
   * of the background is out of focus, and confirms. */
  let {
    open = $bindable(false),
    onconfirm,
    t,
  }: {
    open?: boolean;
    /** The stream to send, and what stops it (the camera, and the blur when it is on). */
    onconfirm(stream: MediaStream, stop: () => void): void;
    t(text: string, vars?: Record<string, string | number>): string;
  } = $props();
  let raw = $state<MediaStream | null>(null);
  let blurred = $state<{ stream: MediaStream; stop(): void } | null>(null);
  let level = $state<Blur>(lastLevel);
  let problem = $state<"" | "camera" | "blur">("");
  let loading = $state(false);
  const shown = $derived(level !== "none" && blurred ? blurred.stream : raw);
  const levels: [Blur, string][] = $derived([
    ["none", t("Sem desfoque")],
    ["light", t("Leve")],
    ["strong", t("Forte")],
  ]);
  function release() {
    blurred?.stop();
    raw?.getTracks().forEach((track) => track.stop());
    raw = blurred = null;
    loading = false;
  }
  async function start() {
    problem = "";
    try {
      raw = await navigator.mediaDevices.getUserMedia({ video: CAM_CAPTURE });
    } catch {
      problem = "camera";
      return;
    }
    if (!open) return release();
    if (level !== "none") await pick(level);
  }
  async function pick(next: Blur) {
    level = next;
    if (next === "none" || blurred || !raw || loading) return;
    loading = true;
    try {
      const { blurCamera } = await import("./blur");
      const made = await blurCamera(raw, () => level);
      if (open && raw) blurred = made;
      else made.stop();
    } catch (error) {
      console.error("camera blur", error);
      problem = "blur";
      level = "none";
    }
    loading = false;
  }
  function confirm() {
    if (!shown || !raw) return;
    lastLevel = level;
    const camera = raw,
      effect = level === "none" ? null : blurred;
    if (!effect) blurred?.stop();
    onconfirm(shown, () => {
      effect?.stop();
      camera.getTracks().forEach((track) => track.stop());
    });
    // Handed over to the call: closing the dialog must not stop it.
    raw = blurred = null;
    open = false;
  }
  $effect(() => {
    if (open) void start();
    else release();
  });
  function stream(node: HTMLVideoElement, value: MediaStream | null) {
    node.srcObject = value;
    return {
      update(next: MediaStream | null) {
        node.srcObject = next;
      },
    };
  }
</script>

<TitledDialog
  bind:open
  title={t("Ligar a câmera")}
  description={t("É assim que as outras pessoas vão ver você.")}
  closeLabel={t("Fechar")}
>
  <div data-camera-dialog class="space-y-4 font-sans text-sm text-foreground">
    <!-- Muted: a camera's picture has no sound. -->
    <video
      use:stream={shown}
      autoplay
      playsinline
      muted
      aria-label={t("Prévia da sua câmera")}
      class="aspect-video w-full rounded-lg bg-muted object-contain"
    ></video>
    {#if problem}<p role="alert" class="m-0 text-xs text-destructive">
        {problem === "camera"
          ? t("Não consegui usar a câmera. Libere o acesso no navegador.")
          : t(
              "O desfoque não funcionou neste navegador. A câmera vai sem ele.",
            )}
      </p>{/if}
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs text-muted-foreground">{t("Fundo")}</span>
      <div role="group" aria-label={t("Fundo")} class="flex gap-1">
        {#each levels as [value, label] (value)}<Button
            size="sm"
            variant="outline"
            aria-pressed={level === value}
            disabled={!raw || loading}
            class="disabled:cursor-not-allowed"
            onclick={() => void pick(value)}>{label}</Button
          >{/each}
      </div>
    </div>
    <div class="flex justify-end gap-2">
      <Button variant="outline" onclick={() => (open = false)}
        >{t("Cancelar")}</Button
      >
      <Button
        disabled={!shown || loading}
        class="disabled:cursor-not-allowed"
        onclick={confirm}>{t("Ligar a câmera")}</Button
      >
    </div>
  </div>
</TitledDialog>
