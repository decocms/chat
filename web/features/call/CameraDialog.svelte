<script lang="ts" module>
  import { writable } from "svelte/store";
  import type { Blur } from "./blur";
  // The level the person chose last, for the next time they turn the camera on in this tab.
  let lastLevel: Blur = "none";
  const MIRROR_KEY = "vb-call-mirror";
  /** My own picture shown as in a mirror, for me only (the others get it as the camera takes it). Kept on this
   *  device; off unless the person turned it on. */
  export const mirrored = writable(
    (() => {
      try {
        return localStorage.getItem(MIRROR_KEY) === "1";
      } catch {
        return false;
      }
    })(),
  );
  export function setMirrored(on: boolean) {
    mirrored.set(on);
    try {
      localStorage.setItem(MIRROR_KEY, on ? "1" : "0");
    } catch {
      // Private mode: it lasts until the page closes.
    }
  }
</script>

<script lang="ts">
  import TitledDialog from "../../lib/components/TitledDialog.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Select from "../../lib/studio/Select.svelte";
  import Switch from "../../lib/studio/Switch.svelte";
  import SelectContent from "../../lib/studio/SelectContent.svelte";
  import SelectItem from "../../lib/studio/SelectItem.svelte";
  import SelectTrigger from "../../lib/studio/SelectTrigger.svelte";
  import SelectValue from "../../lib/studio/SelectValue.svelte";
  import { CAM_CAPTURE } from "./session";
  import {
    audioDevices,
    chosenDevice,
    storedDevice,
    storeDevice,
    SYSTEM_DEVICE,
    type AudioDevice,
  } from "./devices";
  /** Before the camera goes to the call: the person sees the picture that the others will get, chooses how much
   * of the background is out of focus, and confirms. */
  let {
    open = $bindable(false),
    onconfirm,
    onproblem,
    t,
  }: {
    open?: boolean;
    /** The stream to send, and what stops it (the camera, and the blur when it is on). */
    onconfirm(stream: MediaStream, stop: () => void): void;
    /** A camera or blur problem, shown by the call as a toast. */
    onproblem(text: string): void;
    t(text: string, vars?: Record<string, string | number>): string;
  } = $props();
  let raw = $state<MediaStream | null>(null);
  let blurred = $state<{ stream: MediaStream; stop(): void } | null>(null);
  let level = $state<Blur>(lastLevel);
  let loading = $state(false);
  // The cameras of this machine (their names come after the browser allowed one) and the one in use.
  let cameras = $state<AudioDevice[]>([]);
  let camera = $state(storedDevice("videoinput"));
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
    try {
      raw = await navigator.mediaDevices.getUserMedia({
        video:
          camera === SYSTEM_DEVICE
            ? CAM_CAPTURE
            : { ...CAM_CAPTURE, deviceId: { ideal: camera } },
      });
    } catch {
      // No camera: nothing to preview, so the dialog closes and the call says why.
      onproblem(t("Não consegui usar a câmera. Libere o acesso no navegador."));
      open = false;
      return;
    }
    if (!open) return release();
    cameras = audioDevices(
      await navigator.mediaDevices.enumerateDevices().catch(() => []),
      "videoinput",
    );
    // The browser gave another camera than the one stored (it is not plugged in): show the one in use.
    const using = raw.getVideoTracks()[0]?.getSettings().deviceId ?? "";
    camera = chosenDevice(cameras, using);
    if (level !== "none") await pick(level);
  }
  /** Another camera: the preview starts again with it, and it stays for the next calls on this device. */
  async function chooseCamera(id: string) {
    if (id === camera) return;
    camera = id;
    storeDevice("videoinput", id);
    release();
    await start();
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
      onproblem(
        t("O desfoque não funcionou neste navegador. A câmera vai sem ele."),
      );
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
    {#if cameras.length > 1}<div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-muted-foreground">{t("Câmera")}</span>
        <Select
          items={cameras.map((one, index) => ({
            value: one.id,
            label: one.label || t("Câmera {n}", { n: index + 1 }),
          }))}
          bind:value={() => camera, (id) => void chooseCamera(id)}
        >
          <SelectTrigger
            data-camera-choice
            aria-label={t("Câmera")}
            size="sm"
            class="min-w-0 flex-1"><SelectValue /></SelectTrigger
          >
          <SelectContent class="font-sans">
            {#each cameras as one, index (one.id)}<SelectItem
                value={one.id}
                label={one.label || t("Câmera {n}", { n: index + 1 })}
                >{one.label || t("Câmera {n}", { n: index + 1 })}</SelectItem
              >{/each}
          </SelectContent>
        </Select>
      </div>{/if}
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
    <!-- The preview above is what the others get: the mirror is only for my own picture in the call. -->
    <label class="flex items-center gap-2">
      <Switch
        data-camera-mirror
        checked={$mirrored}
        onCheckedChange={setMirrored}
      />
      <span>{t("Espelhar minha imagem na call (só para mim)")}</span>
    </label>
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
