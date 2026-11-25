<script lang="ts">
  import { onDestroy } from "svelte";
  import type { Room } from "../../../shared/room";
  import type { SendRoomCommand } from "../../../shared/commands";
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import Tooltip from "../../lib/studio/Tooltip.svelte";
  import TooltipContent from "../../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../../lib/studio/TooltipTrigger.svelte";
  import DropdownMenu from "../../lib/studio/DropdownMenu.svelte";
  import DropdownMenuContent from "../../lib/studio/DropdownMenuContent.svelte";
  import DropdownMenuItem from "../../lib/studio/DropdownMenuItem.svelte";
  import DropdownMenuCheckboxItem from "../../lib/studio/DropdownMenuCheckboxItem.svelte";
  import DropdownMenuTrigger from "../../lib/studio/DropdownMenuTrigger.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { meetLink, meetMessage } from "./meet";
  import CameraDialog from "./CameraDialog.svelte";
  import { isRecorder } from "../../../shared/call";
  import { denoiseOn, type CallSession } from "./session";
  import { callColors, callGrid, FITTED_ONE } from "./layout";
  import { cn } from "../../lib/studio/utils";
  /** How long a recorded room's call can be without its recorder before the warning shows. */
  const RECORDER_GRACE_MS = 45_000;
  /** The room's call. In the call: the stage (a top bar, the people or the shared screen, a bar of round
   * controls at its foot). Out of it while a call is on: one line with who is there and the way in (phones; the
   * desktop has the top bar's call button). */
  let {
    room,
    call,
    send,
    open,
    avatar,
    title = "",
    fill = false,
    chatHidden,
    onchat,
    staged = true,
    cameraOpen = $bindable(false),
    t,
  }: {
    room: Room;
    call: CallSession;
    send: SendRoomCommand;
    open(url: string): void;
    /** The version of a person's picture. */
    avatar(email: string): number | null | undefined;
    /** Where the call is: the thread's name, or the room's. */
    title?: string;
    /** Desktop: the stage takes all the height beside the chat. */
    fill?: boolean;
    /** Desktop: is the chat column beside the stage hidden? Missing = there is no column to hide (phones). */
    chatHidden?: boolean;
    onchat?(): void;
    /** In the call with the stage closed (the person reads the room): only the toasts and the camera's dialog. */
    staged?: boolean;
    /** The camera's dialog is open (the sidebar's call panel opens it too). */
    cameraOpen?: boolean;
    t(text: string, vars?: Record<string, string | number>): string;
  } = $props();
  const view = $derived(call.state);
  const denoise = denoiseOn;
  const name = (email: string) =>
    (room.names?.[email] ?? email.split("@")[0] ?? "").split(/\s+/)[0];
  // The recorder is in the call's list and is not a person: it shows as the "recording" mark.
  const peers = $derived(
    (room.call ?? []).filter((peer) => !isRecorder(peer.email)),
  );
  const recording = $derived(
    (room.call ?? []).some((peer) => isRecorder(peer.email)),
  );
  const errors = $derived({
    "": "",
    mic: t("Não consegui usar o microfone. Libere o acesso no navegador."),
    failed: t("A call falhou."),
    dropped: t(
      "Você saiu da call (a conexão caiu ou você entrou por outra aba).",
    ),
  });
  const notices = $derived({
    "": "",
    alone: t("Só você está na call: não há ninguém para ver a sua tela."),
    idle: t(
      "Sua tela parou de ser compartilhada: ela ficou 10 minutos sem mudar.",
    ),
  });
  // Every problem or notice of the call is a toast for a few seconds, not a line in the room.
  let toast = $state<{ text: string; error: boolean; retry: boolean } | null>(
    null,
  );
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function showToast(text: string, error = true, retry = false) {
    toast = { text, error, retry };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = null), 6000);
  }
  onDestroy(() => clearTimeout(toastTimer));
  $effect(() => {
    const error = $view.error;
    if (error) showToast(errors[error], true, error !== "mic");
  });
  $effect(() => {
    const notice = $view.notice;
    if (notice) showToast(notices[notice], false);
  });
  // The screen I chose; else the first that someone shares; else my own, so I see what I share.
  const screenOf = (email: string) =>
    email === room.me ? $view.own : ($view.screens[email] ?? null);
  const shownBy = $derived(
    ($view.watching && screenOf($view.watching) ? $view.watching : "") ||
      Object.keys($view.screens)[0] ||
      ($view.own ? room.me : ""),
  );
  const shown = $derived(shownBy ? screenOf(shownBy) : null);
  // In a room whose calls are recorded, a call without the recorder is a problem to see. The recorder takes
  // some seconds to join, so the warning waits.
  let waited = $state(false);
  $effect(() => {
    if ($view.phase !== "in" || recording) {
      waited = false;
      return;
    }
    const timer = setTimeout(() => (waited = true), RECORDER_GRACE_MS);
    return () => clearTimeout(timer);
  });
  // A person alone in a call is not recorded, and gets no warning.
  // A DM's call is recorded only when both say yes (Book.callConsent): the stage asks, and says who is waited for.
  const consent = $derived(
    room.book.dm && room.callRecorded
      ? (room.consent ?? { yes: [], no: [] })
      : null,
  );
  const ask = $derived(
    !!consent &&
      !recording &&
      !consent.no.length &&
      !consent.yes.includes(room.me),
  );
  const consented = $derived(
    !consent ||
      (!consent.no.length &&
        peers.every((peer) => consent.yes.includes(peer.email))),
  );
  const unrecorded = $derived(
    !!room.callRecorded &&
      !recording &&
      waited &&
      peers.length > 1 &&
      consented,
  );
  // The person I put on the stage (a click on a tile). Gone from the call: the grid again.
  let pinned = $state("");
  const pinnedPeer = $derived(peers.find((peer) => peer.email === pinned));
  const camOf = (email: string) =>
    email === room.me ? $view.ownCam : ($view.cams[email] ?? null);
  const speaking = (email: string) => $view.speaking.includes(email);
  const mutedOf = (peer: { email: string; muted?: boolean }) =>
    peer.email === room.me ? $view.muted : !!peer.muted;
  // The grid: as many columns as give each tile the most room, from the stage's own size.
  let gridWidth = $state(0),
    gridHeight = $state(0);
  const grid = $derived(callGrid(peers.length, gridWidth, gridHeight));
  const colors = $derived(callColors(peers.map((peer) => peer.email)));
  let link = $state("");
  let video = $state<HTMLVideoElement | null>(null);
  const valid = $derived(meetLink(link));
  const live = $derived($view.phase === "in");
  function stream(node: HTMLVideoElement, value: MediaStream | null) {
    node.srcObject = value;
    return {
      update(next: MediaStream | null) {
        node.srcObject = next;
      },
    };
  }
  // Desktop: the stage alone goes to full screen, edge to edge, like a video app (Esc or the button brings the room
  // back as it was). Phones: the shared screen's video alone.
  let stage = $state<HTMLElement | null>(null);
  let full = $state(false);
  const canFull = $derived(fill || !!shown);
  function fullscreen() {
    if (!fill) return void video?.requestFullscreen();
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage?.requestFullscreen();
  }
  function onfullscreenchange() {
    full = !!stage && document.fullscreenElement === stage;
  }
  function sendLink() {
    if (!valid) return;
    if (send({ t: "msg", thread: "main", text: meetMessage(room, valid, t) })) {
      link = "";
      call.dismissLimit();
    }
  }
  // The camera's dialog opens over the page: out of full screen first, or it stays behind.
  function openCamera() {
    if (full) void document.exitFullscreen();
    cameraOpen = true;
  }
  // A round control of the bar: 44px, solid. `on`: a white button (the camera or the screen goes out).
  const control =
    "size-11 rounded-full text-call-foreground hover:text-call-foreground [&_svg]:size-5";
</script>

<svelte:document {onfullscreenchange} />
<!-- A person in the call: the camera, or the face on the person's color. The green ring: speaking now. A click
     puts that person on the stage (and takes them off); with a screen on the stage, it picks whose screen. -->
{#snippet tile(
  peer: { email: string; muted?: boolean; tracks?: string[] },
  size: "grid" | "big" | "small",
)}{@const cam = camOf(peer.email)}<button
    type="button"
    data-call-tile
    data-speaking={speaking(peer.email) || undefined}
    aria-pressed={shown ? shownBy === peer.email : pinned === peer.email}
    aria-label={shown && peer.tracks?.includes("screen")
      ? t("Ver a tela de {name}", { name: name(peer.email) })
      : t("Destacar {name}", { name: name(peer.email) })}
    class={[
      "relative flex min-h-0 min-w-0 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-0 p-0 text-call-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      colors[peer.email] ?? "bg-call-1",
      // Every tile is 16:9 (in a box that is a size container: the grid, the stage of one person).
      "aspect-video",
      size === "grid" && grid.width,
      size === "big" && FITTED_ONE,
      size === "small" && "h-20 md:h-24",
    ]}
    onclick={() => {
      if (!shown) pinned = pinned === peer.email ? "" : peer.email;
      else if (peer.tracks?.includes("screen")) call.watch(peer.email);
    }}
    >{#if cam}<!-- Muted: a camera's picture has no sound, the voices play apart. -->
      <video
        use:stream={cam}
        autoplay
        playsinline
        muted
        data-call-cam
        class={[
          "size-full bg-call-chip",
          size === "big" ? "object-contain" : "object-cover",
        ]}
      ></video>{:else}<PersonAvatar
        email={peer.email}
        version={avatar(peer.email)}
        size={size === "small" || (size === "grid" && !fill && grid.rows > 1)
          ? "base"
          : !fill || grid.rows > 2
            ? "lg"
            : "2xl"}
      />{/if}<span
      aria-hidden="true"
      class={[
        "pointer-events-none absolute inset-0 rounded-xl ring-inset",
        speaking(peer.email) ? "ring-3 ring-success" : "ring-0",
      ]}
    ></span><span
      class={[
        "absolute flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-md bg-call-chip text-call-foreground",
        size === "small"
          ? "bottom-1 left-1 px-1.5 py-0.5 text-2xs"
          : "bottom-2 left-2 px-2 py-1 text-xs",
      ]}
      ><span class="truncate">{name(peer.email)}</span>{#if mutedOf(peer)}<span
          data-call-muted
          class="flex shrink-0 text-destructive"
          ><Icon icon="microphone-off-01" size={12} /><span class="sr-only"
            >{t("Microfone desligado")}</span
          ></span
        >{/if}{#if peer.tracks?.includes("screen")}<Icon
          icon="monitor-01"
          size={12}
        />{/if}</span
    ></button
  >{/snippet}
{#if $view.phase !== "idle" && staged}<!-- Desktop: the stage sits a little inside its column, apart from the chat. -->
  <div
    bind:this={stage}
    data-call-full={full || undefined}
    class={full
      ? "h-full min-h-0 bg-call-stage"
      : fill
        ? "h-full min-h-0 md:p-2"
        : ""}
  >
    <section
      data-call-stage
      aria-label={t("Call da sala")}
      class={[
        "flex min-h-0 flex-col bg-call-stage font-sans text-sm text-call-foreground",
        full ? "h-full" : fill ? "h-full md:rounded-xl" : "",
      ]}
    >
      <!-- The stage's top bar: recording, where the call is, how many are in it, full screen. -->
      <div
        data-call-top
        class={[
          "flex shrink-0 items-center gap-2 px-3 text-xs text-call-muted-foreground",
          fill ? "h-12" : "h-9",
        ]}
      >
        {#if recording}<Tooltip>
            <TooltipTrigger>
              {#snippet child({ props })}<span
                  {...props}
                  data-call-recording
                  role="status"
                  class="flex shrink-0 items-center gap-1.5 rounded-full bg-call-chip px-2 py-1 font-medium text-call-foreground"
                  ><span class="size-2 rounded-full bg-destructive"></span>{t(
                    "Gravando",
                  )}</span
                >{/snippet}
            </TooltipTrigger>
            <TooltipContent side="bottom"
              >{t("Gravando: esta call vai para o Grain")}</TooltipContent
            >
          </Tooltip>{:else if ask}<span
            data-call-consent
            role="status"
            class="flex shrink-0 items-center gap-1.5 font-medium text-call-foreground"
            >{t(
              "Gravar esta call no Grain? Só grava se as duas pessoas aceitarem.",
            )}<Button
              size="sm"
              variant="secondary"
              data-call-consent-yes
              onclick={() => send({ t: "call.consent", yes: true })}
              >{t("Gravar")}</Button
            ><Button
              size="sm"
              variant="outline"
              data-call-consent-no
              onclick={() => send({ t: "call.consent", yes: false })}
              >{t("Não gravar")}</Button
            ></span
          >{:else if consent && !recording && consent.no.length}<span
            data-call-consent-declined
            class="shrink-0 rounded-full bg-call-chip px-2 py-1 font-medium text-call-foreground"
            >{t("Esta call não vai ser gravada")}</span
          >{:else if consent && !recording && !consented}<span
            data-call-consent-waiting
            class="shrink-0 rounded-full bg-call-chip px-2 py-1 font-medium text-call-foreground"
            >{t("Gravação: esperando a outra pessoa aceitar")}</span
          >{:else if unrecorded}<span
            data-call-unrecorded
            role="alert"
            class="flex shrink-0 items-center gap-1.5 rounded-full bg-warning px-2 py-1 font-medium text-warning-foreground"
            ><Icon icon="alert-triangle" size={12} />{t(
              "Esta call não está sendo gravada",
            )}</span
          >{/if}
        <span class="min-w-0 truncate font-medium text-call-foreground"
          >{title || room.book.title}</span
        >
        <span data-call-count class="flex shrink-0 items-center gap-1"
          ><Icon icon="users-01" size={14} />{peers.length}</span
        >
        {#if canFull}<IconButton
            label={full ? t("Sair da tela cheia") : t("Tela cheia")}
            tooltipSide="bottom"
            class="ml-auto size-8 rounded-full text-call-muted-foreground hover:bg-call-button hover:text-call-foreground"
            onclick={fullscreen}
            ><Icon
              icon={full ? "minimize-01" : "expand-01"}
              size={16}
            /></IconButton
          >{/if}
      </div>
      <div
        class={[
          "relative flex min-h-0 flex-col gap-2 px-3",
          // Phones: the stage sits in the room's attention slot (30% of its height, RoomLayoutFrame), so the
          // people get what the top bar and the controls leave of it.
          fill ? "flex-1" : "h-[calc(30cqh-7rem)] min-h-24",
        ]}
      >
        {#if shown}<!-- A shared screen takes the stage; the people go in a row under it. -->
          <div
            class="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-call-chip"
          >
            <!-- Muted: the screen has no sound of its own, the voices play apart. -->
            <video
              bind:this={video}
              use:stream={shown}
              autoplay
              playsinline
              muted
              aria-label={shownBy === room.me
                ? t("Sua tela, como os outros veem")
                : t("Tela de {name}", { name: name(shownBy) })}
              class="size-full object-contain"
              ondblclick={fullscreen}
            ></video>
          </div>
          <div
            data-call-people
            class="flex shrink-0 justify-center gap-2 overflow-x-auto"
          >
            {#each peers as peer (peer.email)}{@render tile(
                peer,
                "small",
              )}{/each}
          </div>{:else if pinnedPeer}<!-- One person on the stage: the others in a row under it. -->
          <div
            class="flex min-h-0 flex-1 items-center justify-center [container-type:size]"
          >
            {@render tile(pinnedPeer, "big")}
          </div>
          {#if peers.length > 1}<div
              data-call-strip
              class="flex shrink-0 justify-center gap-2 overflow-x-auto"
            >
              {#each peers.filter((peer) => peer.email !== pinned) as peer (peer.email)}{@render tile(
                  peer,
                  "small",
                )}{/each}
            </div>{/if}{:else}<div
            data-call-people
            bind:clientWidth={gridWidth}
            bind:clientHeight={gridHeight}
            class={[
              "flex min-h-0 flex-1 flex-wrap justify-center gap-2 [container-type:size]",
              grid.scroll
                ? "content-start overflow-y-auto"
                : "content-center items-center",
            ]}
          >
            {#each peers as peer (peer.email)}{@render tile(
                peer,
                "grid",
              )}{/each}
          </div>{/if}
      </div>
      {#if $view.limit}<div
          data-call-limit
          class="mx-3 mt-2 space-y-2 rounded-xl bg-card p-3 text-card-foreground"
        >
          <p class="m-0 text-xs text-muted-foreground">
            {t(
              "O limite de tela deste mês acabou. Abra um Google Meet, cole o link aqui e todo mundo da call recebe.",
            )}
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onclick={() => open("https://meet.new")}
              ><Icon icon="link-external-01" size={14} />{t(
                "Abrir Google Meet",
              )}</Button
            >
            <input
              type="text"
              inputmode="url"
              bind:value={link}
              placeholder="https://meet.google.com/…"
              aria-label={t("Link do Google Meet")}
              class="h-7 min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              onkeydown={(event) => {
                if (event.key === "Enter") sendLink();
              }}
            />
            <Button
              size="sm"
              disabled={!valid}
              class="disabled:cursor-not-allowed"
              onclick={sendLink}>{t("Enviar link")}</Button
            >
            <IconButton label={t("Fechar")} onclick={() => call.dismissLimit()}
              ><Icon icon="x" size={14} /></IconButton
            >
          </div>
        </div>{/if}
      <!-- The controls, like a video app's: microphone and camera, then screen, chat and more, then leave. -->
      <div
        data-call-controls
        class={[
          "flex shrink-0 items-center justify-center gap-2 px-3 md:gap-3",
          fill ? "py-3" : "py-2",
        ]}
      >
        <div class="flex items-center gap-1 rounded-full bg-call-chip p-1">
          <IconButton
            data-call-mic
            label={$view.muted
              ? t("Ativar o microfone")
              : t("Silenciar o microfone")}
            aria-pressed={!$view.muted}
            disabled={!live}
            class={cn(
              control,
              $view.muted
                ? "bg-destructive hover:bg-destructive"
                : "bg-call-button hover:bg-call-button-hover",
            )}
            onclick={() => call.toggleMute()}
            ><Icon
              icon={$view.muted ? "microphone-off-01" : "microphone-01"}
            /></IconButton
          >
          <IconButton
            data-call-camera
            label={$view.camera ? t("Desligar a câmera") : t("Ligar a câmera")}
            aria-pressed={$view.camera}
            disabled={!live}
            class={cn(
              control,
              $view.camera
                ? "bg-call-foreground text-call-chip hover:bg-call-foreground hover:text-call-chip"
                : "bg-call-button hover:bg-call-button-hover",
            )}
            onclick={() => ($view.camera ? call.stopCamera() : openCamera())}
            ><Icon
              icon={$view.camera ? "video-recorder" : "video-recorder-off"}
            /></IconButton
          >
        </div>
        <div class="flex items-center gap-1 rounded-full bg-call-chip p-1">
          <IconButton
            data-call-share
            label={$view.sharing
              ? t("Parar de compartilhar a tela")
              : t("Compartilhar a tela")}
            aria-pressed={$view.sharing}
            disabled={!live}
            class={cn(
              control,
              $view.sharing
                ? "bg-call-foreground text-call-chip hover:bg-call-foreground hover:text-call-chip"
                : "bg-call-button hover:bg-call-button-hover",
            )}
            onclick={() => ($view.sharing ? call.stopShare() : call.share())}
            ><Icon icon="monitor-01" /></IconButton
          >
          {#if chatHidden !== undefined}<IconButton
              data-call-chat
              label={chatHidden ? t("Mostrar o chat") : t("Ocultar o chat")}
              aria-pressed={!chatHidden}
              class={cn(control, "bg-call-button hover:bg-call-button-hover")}
              onclick={() => onchat?.()}
              ><Icon icon="message-circle-01" /></IconButton
            >{/if}
          <DropdownMenu>
            <DropdownMenuTrigger disabled={!live}>
              {#snippet child({ props: trigger })}<IconButton
                  {...trigger}
                  data-call-more
                  label={t("Mais opções")}
                  class={cn(
                    control,
                    "bg-call-button hover:bg-call-button-hover",
                  )}><Icon icon="dots-horizontal" /></IconButton
                >{/snippet}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="center"
              class="w-56 font-sans"
            >
              <DropdownMenuCheckboxItem
                data-call-denoise
                checked={$denoise}
                onCheckedChange={() => void call.toggleDenoise()}
                >{t("Supressão de ruído")}</DropdownMenuCheckboxItem
              >
              <DropdownMenuItem
                data-call-camera-settings
                onSelect={() => {
                  // New settings: the camera starts again from the dialog.
                  if ($view.camera) call.stopCamera();
                  openCamera();
                }}
                ><Icon icon="video-recorder" />{t(
                  "Câmera e desfoque",
                )}</DropdownMenuItem
              >
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <IconButton
          data-call-leave
          label={t("Sair da call")}
          variant="destructive"
          class="ml-1 h-11 w-14 rounded-full text-destructive-foreground hover:bg-destructive [&_svg]:size-5"
          onclick={() => call.leave()}><Icon icon="phone-hang-up" /></IconButton
        >
      </div>
    </section>
  </div>{:else if peers.length && $view.phase === "idle"}<div
    data-call-bar
    class="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 font-sans text-xs text-muted-foreground md:hidden"
  >
    {#if peers.length}<span
        class="flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"
        ><Icon icon="phone" size={12} /></span
      ><span class="shrink-0 font-medium text-foreground"
        >{t("Na call · {n}", { n: peers.length })}</span
      ><span class="flex min-w-0 flex-1 -space-x-1.5"
        >{#each peers.slice(0, 5) as peer (peer.email)}<PersonAvatar
            email={peer.email}
            version={avatar(peer.email)}
            size="xs"
            class="ring-2 ring-background"
          />{/each}</span
      ><Button
        size="sm"
        variant="success"
        class="rounded-full"
        onclick={() => call.join()}
        ><Icon icon="phone" size={14} />{t("Entrar na call")}</Button
      >{/if}
  </div>{/if}
{#if toast}<div
    data-call-toast
    role={toast.error ? "alert" : "status"}
    class={[
      // Low, just over the composer: the chat stays readable. Phones keep it over their composer; on the stage it
      // stays over the round controls.
      staged && $view.phase === "in" ? "bottom-24" : "bottom-24 md:bottom-6",
      "fixed left-1/2 z-[60] flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-xl bg-foreground py-2 pr-2 pl-3.5 font-sans text-sm text-background shadow-lg",
    ]}
  >
    <Icon
      icon={toast.error ? "alert-circle" : "info-circle"}
      size={16}
      class={toast.error ? "shrink-0 text-destructive" : "shrink-0"}
    />
    <p class="m-0 min-w-0 flex-1">{toast.text}</p>
    {#if toast.retry}<Button
        size="sm"
        variant="secondary"
        class="shrink-0 rounded-full"
        onclick={() => {
          toast = null;
          call.join();
        }}>{t("Tentar de novo")}</Button
      >{/if}
    <IconButton
      label={t("Fechar")}
      class="size-8 shrink-0 rounded-full text-background hover:bg-background/15 hover:text-background"
      onclick={() => (toast = null)}><Icon icon="x" size={14} /></IconButton
    >
  </div>{/if}
<CameraDialog
  bind:open={cameraOpen}
  onconfirm={(stream, stop) => call.startCamera(stream, stop)}
  onproblem={(text) => showToast(text)}
  {t}
/>
