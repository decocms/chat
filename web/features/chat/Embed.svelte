<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import type { Attachment } from "../../../shared/room";
  import type { ChatActions, ChatBridge } from "../../app/chatTypes";
  import { createAppConsent } from "../apps/consent";
  import Button from "../../lib/studio/Button.svelte";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import { appDocumentFrameName } from "../../../shared/appDocumentProtocol";
  let {
    url,
    file,
    messageThread,
    actions,
    vb,
  }: {
    url: string;
    file: Attachment;
    messageThread: string;
    actions: ChatActions;
    vb: ChatBridge;
  } = $props();
  let height = $state(320),
    clipped = $state(false);
  const compact = $derived(actions.sideFileName === file.name);
  let active = true,
    epoch = 0,
    frameGeneration = $state(0),
    bridgeDenied = $state(false),
    bridgeRevoked = $state(false),
    bridgeFailed = $state(untrack(() => !actions.mountEmbed)),
    bridgeReady = $state(untrack(() => !actions.mountEmbed));
  const frameName = $derived.by(() => {
    void frameGeneration;
    return appDocumentFrameName();
  });
  const consent = createAppConsent(
      () => active && !bridgeDenied && !bridgeFailed && !bridgeRevoked,
    ),
    question = consent.question;
  const ask = consent.ask;
  function attachFrame(node: HTMLIFrameElement) {
    const ticket = ++epoch;
    const current = () => active && epoch === ticket && node.isConnected;
    const detach = actions.mountEmbed?.(node, file, {
      ask: (what, detail) =>
        current() ? ask(what, detail) : Promise.resolve(false),
      ready: () => {
        if (current() && !bridgeDenied && !bridgeFailed && !bridgeRevoked)
          bridgeReady = true;
      },
      cancel: () => {
        if (current()) consent.cancel();
      },
      deny: () => {
        if (!current()) return;
        bridgeDenied = true;
        consent.cancel();
      },
      fail: () => {
        if (!current()) return;
        bridgeFailed = true;
        consent.cancel();
      },
      revoked: () => {
        if (current()) bridgeRevoked = true;
      },
      thread: messageThread,
      resize: (requested) => {
        if (
          !current() ||
          bridgeDenied ||
          bridgeFailed ||
          bridgeRevoked ||
          !Number.isFinite(requested)
        )
          return;
        const cap = Math.min(420, Math.round(window.innerHeight * 0.55));
        const next = Math.max(Math.ceil(requested) + 2, 40);
        height = Math.min(next, cap);
        clipped = next > cap;
      },
    });
    return {
      destroy() {
        if (epoch === ticket) {
          epoch++;
          consent.cancel();
        }
        detach?.();
      },
    };
  }
  onDestroy(() => {
    active = false;
    epoch++;
    consent.dispose();
  });
  function retry(event: MouseEvent, generation: number) {
    if (
      !active ||
      generation !== frameGeneration ||
      !bridgeFailed ||
      bridgeDenied ||
      !actions.mountEmbed ||
      !event.currentTarget ||
      !(event.currentTarget instanceof HTMLElement) ||
      !event.currentTarget.isConnected
    )
      return;
    // Revoke old callbacks before publishing the new generation: the retired
    // iframe stays connected until Svelte flushes its keyed DOM replacement.
    epoch++;
    consent.cancel();
    bridgeFailed = false;
    bridgeRevoked = false;
    bridgeReady = false;
    height = 320;
    clipped = false;
    frameGeneration++;
  }
  function open(event: MouseEvent) {
    if (
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    if (active) actions.openFile(file);
  }
</script>

<div data-chat-embed class="w-full space-y-2">
  {#if actions.openSideFile}<header class="flex items-center gap-2 text-sm">
      <b class="min-w-0 flex-1 truncate">{file.name}</b>
      {#if compact}<span class="text-xs text-primary"
          >{vb.t("aberto ao lado")}</span
        >{:else}<Button
          variant="ghost"
          onclick={(event) => {
            if (active && event.currentTarget.isConnected)
              actions.openSideFile?.(file);
          }}>{vb.t("Abrir")}</Button
        >{/if}
    </header>{/if}
  <div hidden={compact} class={compact ? "hidden" : "space-y-2"}>
    {#if !bridgeDenied}{#key frameGeneration}<iframe
          name={frameName}
          use:attachFrame
          sandbox="allow-scripts"
          loading="lazy"
          hidden={bridgeFailed}
          aria-busy={!bridgeReady}
          title={file.name}
          {height}
          class="w-full rounded-control border border-border"
        ></iframe>{/key}{:else}<p
        role="alert"
        class="m-0 text-sm text-muted-foreground"
      >
        {vb.t("Você não tem acesso a esta sala.")}
      </p>{/if}
    {#if bridgeFailed}<p role="alert" class="m-0 text-sm text-muted-foreground">
        {bridgeRevoked
          ? vb.locale?.startsWith("en")
            ? "This app document closed. Reopen the app to continue."
            : "O documento deste app foi fechado. Abra o app de novo para continuar."
          : vb.t(
              "Não foi possível iniciar o app. Abra o arquivo para tentar de novo.",
            )}
      </p>
      {#if actions.mountEmbed && !bridgeDenied}{#key frameGeneration}<Snapshot
            value={frameGeneration}
            >{#snippet children(generation)}<Button
                variant="outline"
                onclick={(event) => retry(event, generation)}
                >{vb.locale?.startsWith("en")
                  ? "Reopen app"
                  : "Abrir app de novo"}</Button
              >{/snippet}</Snapshot
          >{/key}{/if}{/if}
  </div>
  <a
    href={url}
    onclick={open}
    class="inline-flex items-center gap-1 rounded-control text-xs text-foreground underline decoration-current/35 underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-ring"
    >{vb.t("Abrir em tela cheia")} ↗</a
  >
  {#if clipped}<p class="m-0 text-xs text-muted-foreground">
      {file.name}
    </p>{/if}
  <div hidden={compact} class={compact ? "hidden" : undefined}>
    {#if $question}{#key $question}<Snapshot value={$question}>
          {#snippet children(intent)}
            <div
              role="group"
              aria-label={vb.t("Confirmar")}
              class="space-y-3 rounded-surface border border-border bg-card p-3"
            >
              <p class="m-0">
                {vb.t("Este app quer {what}, como você:", {
                  what: intent.what,
                })}
              </p>
              <q class="block break-words text-xs text-muted-foreground"
                >{intent.detail}</q
              >
              <div class="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onclick={(event) => {
                    if (event.currentTarget.isConnected)
                      consent.choose(intent, true);
                  }}>{vb.t("Permitir")}</Button
                ><Button
                  size="sm"
                  variant="outline"
                  onclick={(event) => {
                    if (event.currentTarget.isConnected)
                      consent.choose(intent, false);
                  }}>{vb.t("Cancelar")}</Button
                >
              </div>
            </div>{/snippet}</Snapshot
        >{/key}{/if}
  </div>
</div>
