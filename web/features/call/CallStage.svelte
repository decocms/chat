<script lang="ts">
  import type { Room } from "../../../shared/room";
  import type { SendRoomCommand } from "../../../shared/commands";
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { meetLink, meetMessage } from "./meet";
  import CameraDialog from "./CameraDialog.svelte";
  import Badge from "../../lib/studio/Badge.svelte";
  import { isRecorder } from "../../../shared/call";
  import type { CallSession } from "./session";
  /** The room's call. In the call: the stage (the shared screen, or the people) and its controls. Out of it while
   * a call is on: one line with who is there and the way in. */
  let {
    room,
    call,
    send,
    open,
    avatar,
    fill = false,
    chatHidden,
    onchat,
    full = false,
    onfull,
    t,
  }: {
    room: Room;
    call: CallSession;
    send: SendRoomCommand;
    open(url: string): void;
    /** The version of a person's picture. */
    avatar(email: string): number | null | undefined;
    /** Desktop: the stage takes all the height beside the chat. */
    fill?: boolean;
    /** Desktop: is the chat column beside the stage hidden? Missing = there is no column to hide (phones). */
    chatHidden?: boolean;
    onchat?(): void;
    /** Desktop: the call (stage and chat) is in full screen, and the way to turn that on and off. */
    full?: boolean;
    onfull?(): void;
    t(text: string, vars?: Record<string, string | number>): string;
  } = $props();
  const view = $derived(call.state);
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
    failed: t("A call falhou. Tente entrar de novo."),
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
  // The screen I chose; else the first that someone shares; else my own, so I see what I share.
  const screenOf = (email: string) =>
    email === room.me ? $view.own : ($view.screens[email] ?? null);
  const shownBy = $derived(
    ($view.watching && screenOf($view.watching) ? $view.watching : "") ||
      Object.keys($view.screens)[0] ||
      ($view.own ? room.me : ""),
  );
  const shown = $derived(shownBy ? screenOf(shownBy) : null);
  // The person I put on the stage (a click on a tile). Gone from the call: the grid again.
  let pinned = $state("");
  let cameraOpen = $state(false);
  const pinnedPeer = $derived(peers.find((peer) => peer.email === pinned));
  const camOf = (email: string) =>
    email === room.me ? $view.ownCam : ($view.cams[email] ?? null);
  let link = $state("");
  let video = $state<HTMLVideoElement | null>(null);
  const valid = $derived(meetLink(link));
  function stream(node: HTMLVideoElement, value: MediaStream | null) {
    node.srcObject = value;
    return {
      update(next: MediaStream | null) {
        node.srcObject = next;
      },
    };
  }
  // Desktop: the room goes to full screen, so the chat can open beside the stage. Phones: the video alone.
  const fullscreen = () =>
    onfull ? onfull() : void video?.requestFullscreen();
  function sendLink() {
    if (!valid) return;
    if (send({ t: "msg", thread: "main", text: meetMessage(room, valid, t) })) {
      link = "";
      call.dismissLimit();
    }
  }
</script>

<!-- A person's face. The green ring: speaking now. -->
{#snippet face(email: string, size: "xs" | "lg" | "2xl")}<PersonAvatar
    {email}
    version={avatar(email)}
    {size}
    data-speaking={$view.speaking.includes(email) || undefined}
    class={[
      "ring-2",
      $view.speaking.includes(email) ? "ring-success" : "ring-transparent",
    ].join(" ")}
  />{/snippet}
<!-- A person in the call: the camera, or the face. A click puts that person on the stage (and takes them off). -->
{#snippet tile(
  peer: { email: string; muted?: boolean },
  big: boolean,
)}{@const cam = camOf(peer.email)}<button
    type="button"
    data-call-tile
    data-speaking={$view.speaking.includes(peer.email) || undefined}
    aria-pressed={pinned === peer.email}
    aria-label={t("Destacar {name}", { name: name(peer.email) })}
    class={[
      "relative flex min-h-0 min-w-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-0 bg-background p-0 ring-2 outline-none ring-inset focus-visible:ring-ring",
      $view.speaking.includes(peer.email) ? "ring-success" : "ring-transparent",
      big ? "size-full" : "aspect-video h-24 shrink-0",
    ]}
    onclick={() => (pinned = pinned === peer.email ? "" : peer.email)}
    >{#if cam}<!-- Muted: a camera's picture has no sound, the voices play apart. -->
      <video
        use:stream={cam}
        autoplay
        playsinline
        muted
        data-call-cam
        class="size-full object-contain"
      ></video>{:else}{@render face(peer.email, big ? "2xl" : "lg")}{/if}<span
      class="absolute inset-x-1.5 bottom-1.5 flex"
      ><span
        class="flex max-w-full items-center gap-1 rounded-md bg-background/80 px-1.5 py-0.5 text-xs"
        ><span class="truncate">{name(peer.email)}</span>{@render micOff(
          peer,
        )}</span
      ></span
    ></button
  >{/snippet}
<!-- The mark of a microphone that is off: mine from this tab, the others' from the room. -->
{#snippet micOff(peer: {
  email: string;
  muted?: boolean;
})}{#if peer.email === room.me ? $view.muted : peer.muted}<span
      data-call-muted
      class="flex shrink-0 text-destructive"
      ><Icon icon="microphone-off-01" size={12} /><span class="sr-only"
        >{t("Microfone desligado")}</span
      ></span
    >{/if}{/snippet}
{#if $view.phase !== "idle"}<section
    data-call-stage
    aria-label={t("Call da sala")}
    class={[
      "flex min-h-0 flex-col gap-3 p-4 font-sans text-sm text-foreground",
      fill ? "h-full" : "border-b border-border",
    ]}
  >
    <div
      class={[
        "relative flex min-h-0 items-center justify-center overflow-hidden rounded-lg bg-muted",
        fill ? "flex-1" : "aspect-video max-h-64",
      ]}
    >
      {#if shown}<!-- Muted: the screen has no sound of its own, the voices play apart. -->
        <video
          bind:this={video}
          use:stream={shown}
          autoplay
          playsinline
          muted
          aria-label={shownBy === room.me
            ? t("Sua tela, como os outros veem")
            : t("Tela de {name}", { name: name(shownBy) })}
          class="size-full bg-background object-contain"
          ondblclick={fullscreen}
        ></video>
        <IconButton
          label={full ? t("Sair da tela cheia") : t("Tela cheia")}
          variant="outline"
          class="absolute right-2 top-2"
          onclick={fullscreen}
          ><Icon
            icon={full ? "minimize-01" : "expand-01"}
            size={16}
          /></IconButton
        >{:else if pinnedPeer}{@render tile(pinnedPeer, true)}{:else}<div
          data-call-people
          class={[
            "grid size-full auto-rows-fr gap-3 p-3",
            peers.length < 2
              ? "grid-cols-1"
              : peers.length < 5
                ? "grid-cols-2"
                : peers.length < 10
                  ? "grid-cols-3"
                  : "grid-cols-4",
          ]}
        >
          {#each peers as peer (peer.email)}{@render tile(peer, true)}{/each}
        </div>{/if}
    </div>
    <!-- One person on the stage: the others in a row of small tiles. A click on one takes the stage. -->
    {#if !shown && pinnedPeer && peers.length > 1}<div
        data-call-strip
        class="flex shrink-0 justify-center gap-2 overflow-x-auto"
      >
        {#each peers.filter((peer) => peer.email !== pinned) as peer (peer.email)}{@render tile(
            peer,
            false,
          )}{/each}
      </div>{/if}
    {#if shown}<ul
        data-call-people
        class="m-0 flex list-none flex-wrap items-center justify-center gap-2 p-0"
      >
        {#each peers as peer (peer.email)}<li>
            {#if peer.tracks.includes("screen")}<Button
                size="sm"
                variant="outline"
                aria-pressed={shownBy === peer.email}
                aria-label={t("Ver a tela de {name}", {
                  name: name(peer.email),
                })}
                onclick={() => call.watch(peer.email)}
                >{@render face(peer.email, "xs")}{name(
                  peer.email,
                )}{@render micOff(peer)}<Icon
                  icon="monitor-01"
                  size={14}
                /></Button
              >{:else}<span
                class="flex h-7 items-center gap-1.5 px-2 text-xs text-muted-foreground"
                >{@render face(peer.email, "xs")}{name(
                  peer.email,
                )}{@render micOff(peer)}</span
              >{/if}
          </li>{/each}
      </ul>{/if}
    {#if $view.notice}<p
        data-call-notice
        role="status"
        class="m-0 text-center text-xs text-muted-foreground"
      >
        {notices[$view.notice]}
      </p>{/if}
    {#if $view.limit}<div data-call-limit class="space-y-2">
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
    {#if recording}<p
        data-call-recording
        role="status"
        class="m-0 flex items-center justify-center"
      >
        <Badge variant="destructive"
          ><Icon icon="circle" size={10} />{t(
            "Gravando: esta call vai para o Grain",
          )}</Badge
        >
      </p>{/if}
    <div
      data-call-controls
      class="flex flex-wrap items-center justify-center gap-2"
    >
      <Button
        variant="outline"
        aria-pressed={!$view.muted}
        disabled={$view.phase !== "in"}
        class="disabled:cursor-not-allowed"
        onclick={() => call.toggleMute()}
        ><Icon
          icon={$view.muted ? "microphone-off-01" : "microphone-01"}
          size={16}
        />{$view.muted
          ? t("Ativar o microfone")
          : t("Silenciar o microfone")}</Button
      >
      <Button
        variant="outline"
        aria-pressed={$view.camera}
        disabled={$view.phase !== "in"}
        class="disabled:cursor-not-allowed"
        onclick={() => {
          if ($view.camera) return call.stopCamera();
          // The dialog opens over the page: out of full screen first, or it stays behind.
          if (full) onfull?.();
          cameraOpen = true;
        }}
        ><Icon
          icon={$view.camera ? "video-recorder" : "video-recorder-off"}
          size={16}
        />{$view.camera ? t("Desligar a câmera") : t("Ligar a câmera")}</Button
      >
      <Button
        variant="outline"
        aria-pressed={$view.sharing}
        disabled={$view.phase !== "in"}
        class="disabled:cursor-not-allowed"
        onclick={() => ($view.sharing ? call.stopShare() : call.share())}
        ><Icon icon="monitor-01" size={16} />{$view.sharing
          ? t("Parar de compartilhar a tela")
          : t("Compartilhar a tela")}</Button
      >
      {#if shown}<Button variant="outline" onclick={fullscreen}
          ><Icon icon={full ? "minimize-01" : "expand-01"} size={16} />{full
            ? t("Sair da tela cheia")
            : t("Tela cheia")}</Button
        >{/if}
      {#if chatHidden !== undefined}<Button
          variant="outline"
          aria-pressed={!chatHidden}
          onclick={() => onchat?.()}
          ><Icon icon="message-circle-01" size={16} />{chatHidden
            ? t("Mostrar o chat")
            : t("Ocultar o chat")}</Button
        >{/if}
      <Button variant="destructive" onclick={() => call.leave()}
        ><Icon icon="log-out-01" size={16} />{t("Sair da call")}</Button
      >
    </div>
  </section>{:else if peers.length || $view.error}<div
    data-call-bar
    class="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 font-sans text-xs text-muted-foreground"
  >
    {#if peers.length}<Icon icon="phone-01" size={14} />{#if recording}<Badge
          variant="destructive">{t("Gravando")}</Badge
        >{/if}<span class="min-w-0 flex-1 truncate"
        >{t("Na call: {people}", {
          people: peers.map((peer) => name(peer.email)).join(", "),
        })}</span
      ><Button size="sm" variant="outline" onclick={() => call.join()}
        >{t("Entrar na call ({n})", { n: peers.length })}</Button
      >{/if}
    {#if $view.error}<p role="alert" class="m-0 basis-full text-destructive">
        {errors[$view.error]}
      </p>{/if}
  </div>{/if}
<CameraDialog
  bind:open={cameraOpen}
  onconfirm={(stream, stop) => call.startCamera(stream, stop)}
  {t}
/>
