<script lang="ts">
  import { visibleMessage, messageById } from "../chat/privacy";
  import { browserSpeech } from "./speech";
  import { browserFireCapture } from "./fireAudio";
  import { onDestroy, onMount, untrack } from "svelte";
  import type { ComposerProps } from "./types";
  import type { PendingAttachment } from "./model";
  import {
    FILE_ACCEPT,
    knownMention,
    mentionPicks,
    emojiTyped,
    quoteSnippet,
    composerError,
  } from "./model";
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import Avatar from "../../lib/studio/Avatar.svelte";
  import AgentMark from "../../lib/components/AgentMark.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { File02, ReverseLeft, X } from "../../lib/studio/icons";
  import OrphanDrafts from "./OrphanDrafts.svelte";
  import ChatField from "./ChatField.svelte";
  import PollCreateDialog from "./PollCreateDialog.svelte";
  let {
    room,
    thread,
    vb,
    drafts,
    request,
    upload,
    navigate,
    agents = [],
    hidden = false,
    speechFactory,
    mediaFactory,
    voice: voicePort,
  }: ComposerProps = $props();
  const entry = untrack(() =>
    drafts.entry({ account: room.me, roomId: room.id, thread }),
  );
  const draft = entry.state;
  const uid = $props.id();
  let dictating = $state(false),
    refining = $state(false),
    voiceWaiting = $state(false),
    voiceIssue = $state("");
  let active = true,
    field = $state<ChatField | null>(null),
    textarea = $state<HTMLTextAreaElement | null>(null),
    fileInput = $state<HTMLInputElement | null>(null),
    root = $state<HTMLElement | null>(null),
    poll = $state(false),
    dragging = $state(false),
    caret = $state(0),
    selectionEnd = $state(0),
    pickAt = $state(0),
    mentionClosed = $state(false);
  const ownedSpeechFactory = untrack(() =>
    speechFactory === undefined ? browserSpeech(window) : speechFactory,
  );
  const ownedCaptureFactory = untrack(() =>
    mediaFactory === undefined ? browserFireCapture(window) : mediaFactory,
  );
  const ownedVoicePort = untrack(() => voicePort);
  const transcribe = ownedVoicePort
    ? (audio: Blob, signal: AbortSignal) =>
        ownedVoicePort.transcribe(audio, signal)
    : undefined;
  const detachVoice = untrack(() =>
    ownedVoicePort?.beforeLeave(() => field?.cancel()),
  );
  const previews = new Map<number, { file: File; url: string }>();
  const allowed = $derived(
    $draft.error !== "draft-limit" &&
      entry.available() &&
      room.members.includes(room.me) &&
      (thread === "main" || room.epics.some((epic) => epic.id === thread)),
  );
  const reply = $derived(
    $draft.replyId
      ? [...room.messages, ...(room.origins || [])].find(
          (message) =>
            message.id === $draft.replyId &&
            message.thread === thread &&
            visibleMessage(room, message),
        )
      : undefined,
  );
  const candidateTarget = $derived.by(() => {
    if (!$draft.candidate) return undefined;
    const candidate = messageById(room, $draft.candidate);
    if (candidate && visibleMessage(room, candidate)) return candidate.id;
    const parent = candidate?.reply_to
      ? messageById(room, candidate.reply_to)
      : undefined;
    return parent && visibleMessage(room, parent) ? parent.id : undefined;
  });
  const mentions = $derived(
    !hidden && !mentionClosed
      ? mentionPicks($draft.text, caret, room, vb.knownNames, agents)
      : null,
  );
  // `:sho` suggests emoji the same way `@par` suggests people (same list, keys and close rules).
  const emojis = $derived(
    !hidden && !mentionClosed && !mentions
      ? emojiTyped($draft.text, caret)
      : null,
  );
  const items = $derived(mentions?.items || emojis?.items || []);
  const selected = $derived(items.length ? pickAt % items.length : 0);
  const busy = $derived(
    $draft.phase === "pending" || $draft.phase === "unconfirmed",
  );
  $effect(() => {
    if (hidden) {
      poll = false;
      mentionClosed = true;
    }
  });
  $effect(() => {
    const snapshot = room,
      send = request,
      put = upload;
    untrack(() => entry.sync(snapshot, send, put));
  });
  $effect(() => {
    const items = $draft.attachments;
    untrack(() => {
      for (const [id, preview] of previews)
        if (
          !items.some((item) => item.id === id && item.file === preview.file)
        ) {
          URL.revokeObjectURL(preview.url);
          previews.delete(id);
        }
    });
  });
  function preview(item: PendingAttachment) {
    if (item.meta && item.type.startsWith("image/"))
      return `/api/books/${encodeURIComponent(room.id)}/files/${encodeURIComponent(item.meta.id)}`;
    if (!item.file || !item.type.startsWith("image/")) return undefined;
    const previous = previews.get(item.id);
    if (previous?.file === item.file) return previous.url;
    if (previous) URL.revokeObjectURL(previous.url);
    const url = URL.createObjectURL(item.file);
    previews.set(item.id, { file: item.file, url });
    return url;
  }
  const detachFocus = entry.attachFocus(() => {
    void field?.focus();
  });
  let blurTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => {
    active = false;
    detachVoice?.();
    clearTimeout(blurTimer);
    detachFocus();
    for (const preview of previews.values()) URL.revokeObjectURL(preview.url);
    previews.clear();
  });
  function canInteract(event?: Event) {
    return (
      active &&
      // RoomScene's live spread may already be null while this outgoing DOM
      // remains connected. Captured authority must fence reads of those props.
      (!ownedVoicePort || ownedVoicePort.current()) &&
      entry.available() &&
      !!root?.isConnected &&
      !hidden &&
      allowed &&
      (!event ||
        (!voiceWaiting &&
          event.currentTarget instanceof HTMLElement &&
          event.currentTarget.isConnected))
    );
  }
  function choose(index: number) {
    if (!active || !allowed) return;
    if (emojis) {
      const pick = emojis.items[index];
      if (!pick) return;
      // Replace the typed ":sho" (from its colon to the caret) with the emoji.
      selectionEnd = caret;
      caret = emojis.start;
      field?.insert(`${pick.emoji} `);
      return;
    }
    const pick = mentions?.items[index];
    if (!mentions || !pick) return;
    // Replace the typed "@par" (from its @ to the caret) with the handle.
    selectionEnd = caret;
    caret = mentions.start;
    field?.insert(`@${pick.handle} `);
  }
  function keydown(event: KeyboardEvent) {
    if (items.length) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        pickAt =
          (selected + (event.key === "ArrowDown" ? 1 : items.length - 1)) %
          items.length;
        return true;
      }
      if (
        (event.key === "Enter" || event.key === "Tab") &&
        !event.isComposing
      ) {
        event.preventDefault();
        choose(selected);
        return true;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        mentionClosed = true;
        return true;
      }
    }
    if (event.key === "Escape" && $draft.replyId) {
      event.preventDefault();
      event.stopPropagation();
      entry.clearReply();
      return true;
    }
    return false;
  }
  onMount(() => {
    // Paste and file drop work anywhere in the room. The Studio layout (#45) has no <main> around the room,
    // so closest("main") alone left paste and drop dead.
    const main =
      root?.closest<HTMLElement>("[data-native-room-layout]") ??
      root?.closest("main");
    const paste = (event: ClipboardEvent) => {
      const target = event.target,
        typing =
          target instanceof HTMLElement &&
          (target.isContentEditable ||
            /^(INPUT|TEXTAREA)$/.test(target.tagName));
      if (
        hidden ||
        !active ||
        !allowed ||
        !textarea?.isConnected ||
        (typing && target !== textarea)
      )
        return;
      const focused = document.activeElement;
      const modal = [
        ...document.querySelectorAll<HTMLElement>(
          'dialog[open],[role="dialog"],[role="alertdialog"]',
        ),
      ].find(
        (element) =>
          element.dataset.state !== "closed" &&
          !element.hidden &&
          element.getAttribute("aria-hidden") !== "true",
      );
      if (modal && target !== textarea) return;
      if (
        target instanceof Node &&
        target !== document.body &&
        !main?.contains(target)
      )
        return;
      if (
        focused instanceof HTMLElement &&
        focused !== document.body &&
        !main?.contains(focused) &&
        target !== textarea
      )
        return;
      let files = [...(event.clipboardData?.files || [])];
      if (!files.length)
        files = [...(event.clipboardData?.items || [])]
          .filter((item) => item.kind === "file")
          .flatMap((item) => {
            const file = item.getAsFile();
            return file ? [file] : [];
          });
      if (files.length) {
        event.preventDefault();
        entry.addFiles(files);
        void field?.focus();
      }
    };
    const drag = (event: DragEvent) => {
      if (
        !active ||
        hidden ||
        !allowed ||
        !event.dataTransfer?.types.includes("Files")
      )
        return;
      event.preventDefault();
      dragging = true;
    };
    const leave = (event: DragEvent) => {
      if (
        !(event.relatedTarget instanceof Node) ||
        !main?.contains(event.relatedTarget)
      )
        dragging = false;
    };
    const drop = (event: DragEvent) => {
      if (!active || hidden || !allowed) return;
      const files = [...(event.dataTransfer?.files || [])];
      if (files.length) {
        event.preventDefault();
        entry.addFiles(files);
        void field?.focus();
      }
      dragging = false;
    };
    document.addEventListener("paste", paste);
    main?.addEventListener("dragover", drag);
    main?.addEventListener("dragleave", leave);
    main?.addEventListener("drop", drop);
    return () => {
      document.removeEventListener("paste", paste);
      main?.removeEventListener("dragover", drag);
      main?.removeEventListener("dragleave", leave);
      main?.removeEventListener("drop", drop);
    };
  });
</script>

<section
  bind:this={root}
  data-native-composer
  data-vb-native
  {hidden}
  class={hidden
    ? "tw:hidden"
    : "tw:relative tw:shrink-0 tw:space-y-2 tw:bg-background tw:px-3 tw:pt-1 tw:pb-3 tw:font-sans tw:text-sm tw:text-foreground tw:sm:px-4 tw:sm:pb-4"}
>
  {#if dragging}<div
      role="status"
      class="tw:rounded-control tw:border-2 tw:border-dashed tw:border-primary tw:bg-primary/10 tw:p-4 tw:text-center"
    >
      {vb.t("Anexar arquivo")}
    </div>{/if}
  {#if $draft.attachments.length}<div class="tw:flex tw:flex-wrap tw:gap-2">
      {#each $draft.attachments as item (item.id)}{@const image = preview(item)}
        <div
          data-composer-attachment={item.id}
          class="tw:relative tw:flex tw:w-32 tw:flex-col tw:gap-1 tw:rounded-control tw:border tw:border-border tw:bg-card tw:p-2"
        >
          {#if image}<img
              src={image}
              alt={item.name}
              class="tw:h-20 tw:w-full tw:rounded-sm tw:object-cover"
            />{:else}<Icon icon={File02} size={16} />{/if}<span
            class="tw:break-words tw:text-xs">{item.name}</span
          ><span role="status" class="tw:text-xs tw:text-muted-foreground"
            >{item.phase === "queued" || item.phase === "uploading"
              ? vb.t("Enviando…")
              : item.phase === "error"
                ? composerError(item.error || "failed", vb.t)
                : vb.t("Pronto")}</span
          >{#if item.phase === "error"}<Button
              size="sm"
              variant="outline"
              onclick={(event) => {
                if (canInteract(event)) entry.retryUpload(item.id);
              }}>{vb.t("Tentar novamente")}</Button
            >{/if}<IconButton
            label={vb.t("Remover anexo")}
            size="icon-xs"
            class="tw:absolute tw:right-1 tw:top-1 tw:rounded-full tw:bg-card tw:shadow-edge"
            onclick={(event) => {
              if (canInteract(event)) entry.removeFile(item.id);
            }}><Icon icon={X} size={14} /></IconButton
          >
        </div>{/each}
    </div>{/if}
  {#if $draft.replyId}<div
      data-composer-reply
      class="tw:flex tw:items-center tw:gap-2 tw:rounded-control tw:border-l-2 tw:border-foreground tw:bg-muted tw:p-2"
    >
      <Icon icon={ReverseLeft} size={16} />
      <div class="tw:min-w-0 tw:flex-1 tw:text-xs">
        {#if reply}<b
            >{reply.author === "ai"
              ? "@vibe"
              : reply.kind === "agent"
                ? vb.t("{via} de {who}", {
                    via: "Agent",
                    who: vb.name(reply.author),
                  })
                : vb.name(reply.author)}</b
          ><span class="tw:block tw:truncate"
            >{!reply.text && reply.poll
              ? vb.t("votação")
              : quoteSnippet(reply)}</span
          >{:else}{vb.t("A mensagem não está mais disponível.")}{/if}
      </div>
      <IconButton
        label={vb.t("Cancelar resposta")}
        onclick={(event) => {
          if (canInteract(event)) entry.clearReply();
        }}><Icon icon={X} size={16} /></IconButton
      >
    </div>{/if}
  {#if items.length}<div
      id={`${uid}-mentions`}
      role="listbox"
      aria-label={emojis ? vb.t("Emoji") : vb.t("Mencionar")}
      class="tw:absolute tw:bottom-full tw:left-3 tw:z-20 tw:max-h-64 tw:max-w-[calc(100%-1.5rem)] tw:overflow-auto tw:rounded-xl tw:bg-popover tw:p-1 tw:text-popover-foreground tw:shadow-edge-raised"
    >
      {#if emojis}{#each emojis.items as item, index}<button
            id={`${uid}-mention-${index}`}
            type="button"
            role="option"
            aria-selected={selected === index}
            data-emoji-pick={item.emoji}
            class={selected === index
              ? "tw:flex tw:min-h-8 tw:w-full tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-lg tw:bg-accent tw:px-2 tw:py-1.5 tw:text-left"
              : "tw:flex tw:min-h-8 tw:w-full tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-lg tw:px-2 tw:py-1.5 tw:text-left tw:hover:bg-accent"}
            onpointerdown={(event) => {
              event.preventDefault();
              choose(index);
            }}
            onclick={() => choose(index)}
            ><span aria-hidden="true" class="tw:w-6 tw:text-center tw:text-lg"
              >{item.emoji}</span
            ><span class="tw:text-muted-foreground">:{item.name}:</span></button
          >{/each}{:else}
        {#each mentions?.items || [] as item, index}<button
            id={`${uid}-mention-${index}`}
            type="button"
            role="option"
            aria-selected={selected === index}
            class={selected === index
              ? "tw:flex tw:min-h-8 tw:w-full tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-lg tw:bg-accent tw:px-2 tw:py-1.5 tw:text-left"
              : "tw:flex tw:min-h-8 tw:w-full tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-lg tw:px-2 tw:py-1.5 tw:text-left tw:hover:bg-accent"}
            onpointerdown={(event) => {
              event.preventDefault();
              choose(index);
            }}
            onclick={() => choose(index)}
            >{#if item.agent}<AgentMark
                size="xs"
              />{:else if item.email}<PersonAvatar
                data-avatar="person"
                size="xs"
                name={vb.name(item.email)}
                url={vb.avatarUrl?.(item.email)}
              />{:else}<Avatar
                shape="circle"
                size="xs"
                aria-hidden="true"
                fallback="@"
              />{/if}<b>@{item.handle}</b><small
              class="tw:text-muted-foreground">{vb.t(item.label)}</small
            ></button
          >{/each}{/if}
    </div>{/if}
  {#if refining || voiceWaiting}<p
      role="status"
      data-composer-transcribing
      class="tw:m-0 tw:flex tw:items-center tw:gap-2 tw:text-xs tw:text-muted-foreground"
    >
      <Spinner size="2xs" />
      {vb.locale?.startsWith("en")
        ? "Refining transcription…"
        : "Refinando transcrição…"}
    </p>{/if}
  <ChatField
    bind:this={field}
    bind:textarea
    bind:caret
    bind:selectionEnd
    bind:dictating
    bind:refining
    bind:waiting={voiceWaiting}
    bind:voiceIssue
    value={$draft.text}
    revision={$draft.revision}
    onedit={(text) => {
      entry.edit(text);
      mentionClosed = true;
    }}
    oninputtext={() => {
      clearTimeout(blurTimer);
      pickAt = 0;
      mentionClosed = false;
    }}
    onblurfield={() => {
      blurTimer = setTimeout(() => {
        if (active) mentionClosed = true;
      }, 100);
    }}
    onsubmit={() => {
      if (canInteract()) void entry.submit();
    }}
    onkeydown={keydown}
    mention={(handle) => knownMention(handle, room, vb.knownNames)}
    t={vb.t}
    locale={vb.locale || "pt-BR"}
    id="input"
    label={vb.t("Mensagem…")}
    placeholder={vb.t("Mensagem…")}
    disabled={!allowed || hidden}
    enabled={() => canInteract()}
    {busy}
    pending={$draft.phase === "pending"}
    sendDisabled={(!$draft.text.trim() && !$draft.attachments.length) ||
      $draft.attachments.some(
        (item) => item.phase === "queued" || item.phase === "uploading",
      )}
    speechFactory={ownedSpeechFactory}
    captureFactory={ownedCaptureFactory}
    {transcribe}
    inputProps={{
      "aria-autocomplete": "list",
      "aria-controls": items.length ? `${uid}-mentions` : undefined,
      "aria-activedescendant": items.length
        ? `${uid}-mention-${selected}`
        : undefined,
      onfocus: () => clearTimeout(blurTimer),
    }}
  >
    {#snippet menu(close)}<Button
        variant="menu"
        role="menuitem"
        onclick={(event) => {
          if (!canInteract(event)) return;
          close();
          fileInput?.click();
        }}>{vb.t("Anexar arquivo")} <small>{vb.t("ou Cmd+V")}</small></Button
      ><Button
        variant="menu"
        role="menuitem"
        onclick={(event) => {
          if (!canInteract(event)) return;
          close();
          const before = $draft.text.slice(0, caret);
          field?.insert(before && !/\s$/.test(before) ? " @" : "@");
          mentionClosed = false;
        }}>{vb.t("Mencionar alguém")} @</Button
      ><Button
        variant="menu"
        role="menuitem"
        onclick={(event) => {
          if (!canInteract(event)) return;
          close();
          poll = true;
        }}>{vb.t("Criar votação")}</Button
      >{/snippet}
    {#snippet inside()}{#if !thread.startsWith("pre:") && !room.briefs?.some((item) => item.thread === thread && !item.answered_at)}<Button
          variant="outline"
          size="sm"
          data-brief-ask
          class="tw:h-7 tw:rounded-full tw:px-2.5 tw:text-xs tw:text-muted-foreground tw:hover:text-foreground"
          onclick={(event) => {
            if (canInteract(event)) void request({ t: "brief.ask", thread });
          }}>{vb.t("O que precisa de mim aqui?")}</Button
        >{/if}{/snippet}
  </ChatField>
  <input
    bind:this={fileInput}
    type="file"
    class="tw:hidden"
    accept={FILE_ACCEPT}
    multiple
    hidden
    onchange={(event) => {
      if (!canInteract(event)) return;
      entry.addFiles([...(event.currentTarget.files || [])]);
      event.currentTarget.value = "";
    }}
  />
  {#if $draft.phase === "unconfirmed"}<p
      role="status"
      class="tw:m-0 tw:text-xs tw:text-muted-foreground"
    >
      {vb.t(
        "Ainda sem confirmação. Confira a sala antes de enviar novamente.",
      )}{#if candidateTarget}<Button
          variant="link"
          size="sm"
          class="tw:h-auto tw:text-xs tw:text-foreground tw:underline tw:decoration-current/35 tw:underline-offset-4 tw:hover:decoration-current"
          onclick={(event) => {
            if (canInteract(event) && candidateTarget)
              navigate(candidateTarget);
          }}>{vb.t("Ver mensagem correspondente")}</Button
        >{/if}
    </p>
    <div class="tw:flex tw:flex-wrap tw:gap-2">
      <Button
        size="sm"
        variant="outline"
        onclick={(event) => {
          if (canInteract(event)) entry.review(true);
        }}>{vb.t("Conferi a sala; manter rascunho")}</Button
      ><Button
        size="sm"
        variant="ghost"
        onclick={(event) => {
          if (canInteract(event)) entry.review(false);
        }}>{vb.t("Conferi a sala; descartar rascunho")}</Button
      >
    </div>
  {:else if $draft.error}<p
      role="alert"
      class="tw:m-0 tw:break-words tw:text-xs tw:text-destructive"
    >
      {composerError($draft.error, vb.t)}
    </p>{/if}
  <!-- A plain send needs no line under the chat (the message showing up says it): "Sent" is for screen readers only. -->
  {#if $draft.notice}<p
      role="status"
      class={$draft.notice === "sent"
        ? "tw:sr-only"
        : "tw:m-0 tw:text-xs tw:text-muted-foreground"}
    >
      {$draft.notice === "sent"
        ? vb.t("Enviado")
        : $draft.notice === "sent-edited"
          ? vb.t("Enviado. Seu novo rascunho foi mantido.")
          : $draft.notice === "poll-created"
            ? vb.t("Votação criada")
            : $draft.notice === "reviewed-discarded"
              ? vb.t("Rascunho descartado")
              : vb.t("Rascunho mantido")}
    </p>{/if}
  {#if dictating}<p
      role="status"
      data-composer-dictating
      class="tw:m-0 tw:text-xs tw:text-destructive"
    >
      {vb.t("Ouvindo… Escape para parar.")}
    </p>{/if}
  {#if voiceIssue}<p
      role="status"
      class="tw:m-0 tw:text-xs tw:text-destructive"
    >
      {voiceIssue === "not-allowed"
        ? vb.t("O navegador não deixou usar o microfone.")
        : voiceIssue === "invalid-result"
          ? vb.t("O ditado foi interrompido. Seu rascunho foi mantido.")
          : vb.t("Não foi possível iniciar o ditado.")}
    </p>{/if}
  <OrphanDrafts {room} {drafts} {vb} />
  <PollCreateDialog {entry} {vb} bind:open={poll} />
</section>
