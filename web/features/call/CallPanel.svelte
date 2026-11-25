<script lang="ts">
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { cn } from "../../lib/studio/utils";
  import type { CallSession } from "./session";
  /** The call I am in, at the foot of the sidebar (like Discord's "Voice Connected"): it stays while I read the
   * room, the threads and the docs with the stage closed. A click on it opens the stage again; under it the
   * microphone, the camera, the screen; at its right the hang-up. The narrow rail: one green phone. */
  let {
    call,
    title,
    collapsed = false,
    onopen,
    oncamera,
    t,
  }: {
    call: CallSession;
    /** Where the call is: the call's thread, or the room. */
    title: string;
    collapsed?: boolean;
    /** Opens the stage. */
    onopen(): void;
    /** Opens the camera's dialog (the camera starts from it). */
    oncamera(): void;
    t(text: string, vars?: Record<string, string | number>): string;
  } = $props();
  const view = $derived(call.state);
  const live = $derived($view.phase === "in");
  // The panel has the color of the box under it (you and your agent, SidebarFoot). A round control: solid. `on`: the camera or the screen goes out.
  const control = "size-8 rounded-full [&_svg]:size-4";
  const idle =
    "bg-background text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground";
  const on =
    "bg-sidebar-foreground text-sidebar hover:bg-sidebar-foreground hover:text-sidebar";
</script>

{#if $view.phase !== "idle"}{#if collapsed}<IconButton
      data-call-panel
      label={t("Voltar para a call")}
      tooltipSide="right"
      variant="success"
      class="size-8 rounded-full"
      onclick={onopen}><Icon icon="phone" size={16} /></IconButton
    >{:else}<div
      data-call-panel
      class="flex flex-col gap-2 rounded-xl bg-sidebar-accent/50 p-2 font-sans text-sidebar-foreground"
    >
      <div class="flex items-center gap-1">
        <button
          type="button"
          data-call-panel-open
          aria-label={t("Voltar para a call")}
          class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent p-1 text-left outline-none hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-ring"
          onclick={onopen}
        >
          <span
            class="flex size-7 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"
            ><Icon icon="phone" size={14} /></span
          >
          <span class="flex min-w-0 flex-col leading-tight">
            <span class="text-sm font-semibold text-success"
              >{live ? t("Na call") : t("Conectando…")}</span
            >
            <span class="truncate text-xs text-muted-foreground">{title}</span>
          </span>
        </button>
        <IconButton
          data-call-panel-leave
          label={t("Sair da call")}
          variant="destructive"
          class="size-8 shrink-0 rounded-full hover:bg-destructive [&_svg]:size-4"
          onclick={() => call.leave()}><Icon icon="phone-hang-up" /></IconButton
        >
      </div>
      <div class="flex items-center gap-1.5 px-1">
        <IconButton
          data-call-panel-mic
          label={$view.muted
            ? t("Ativar o microfone")
            : t("Silenciar o microfone")}
          aria-pressed={!$view.muted}
          disabled={!live}
          class={cn(
            control,
            $view.muted
              ? "bg-destructive text-destructive-foreground hover:bg-destructive hover:text-destructive-foreground"
              : idle,
          )}
          onclick={() => call.toggleMute()}
          ><Icon
            icon={$view.muted ? "microphone-off-01" : "microphone-01"}
          /></IconButton
        >
        <IconButton
          data-call-panel-camera
          label={$view.camera ? t("Desligar a câmera") : t("Ligar a câmera")}
          aria-pressed={$view.camera}
          disabled={!live}
          class={cn(control, $view.camera ? on : idle)}
          onclick={() => ($view.camera ? call.stopCamera() : oncamera())}
          ><Icon
            icon={$view.camera ? "video-recorder" : "video-recorder-off"}
          /></IconButton
        >
        <IconButton
          data-call-panel-share
          label={$view.sharing
            ? t("Parar de compartilhar a tela")
            : t("Compartilhar a tela")}
          aria-pressed={$view.sharing}
          disabled={!live}
          class={cn(control, $view.sharing ? on : idle)}
          onclick={() => ($view.sharing ? call.stopShare() : call.share())}
          ><Icon icon="monitor-01" /></IconButton
        >
      </div>
    </div>{/if}{/if}
