<script module lang="ts">
  /** The last room and thread a composer mounted for (`me:room:thread`). */
  let lastEntered = "";
</script>

<script lang="ts">
  import { visibleMessage, messageById } from "../chat/privacy";
  import { lastEditable } from "../chat/model";
  import { startEditing } from "../chat/editing";
  import { roomHasThread } from "../../../shared/call";
  import { COMPOSER_FRAME } from "./shape";
  import { MARK_DONE } from "../../../shared/epicStatus";
  import { browserSpeech } from "./speech";
  import { browserFireCapture } from "./fireAudio";
  import { onDestroy, onMount, untrack } from "svelte";
  import { MOBILE_QUERY } from "../../lib/breakpoints";
  import type { ComposerProps } from "./types";
  import type { PendingAttachment } from "./model";
  import {
    FILE_ACCEPT,
    knownMention,
    mentionPicks,
    emojiTyped,
    roomPicks,
    roomReference,
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
  import Chip from "../../lib/studio/Chip.svelte";
  import RoomMark from "../room-sidebar/RoomMark.svelte";
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
    rooms = [],
    hidden = false,
    speechFactory,
    mediaFactory,
    voice: voicePort,
    onsend,
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
      roomHasThread(room, thread),
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
  // `#sal` suggests rooms and this room's threads, `:sho` emoji, the same way `@par` suggests people (same list,
  // keys and close rules).
  const places = $derived(
    !hidden && !mentionClosed && !mentions
      ? roomPicks($draft.text, caret, rooms, room, window.location.origin)
      : null,
  );
  const emojis = $derived(
    !hidden && !mentionClosed && !mentions && !places
      ? emojiTyped($draft.text, caret)
      : null,
  );
  const items = $derived(
    mentions?.items || places?.items || emojis?.items || [],
  );
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
    if (places) {
      const pick = places.items[index];
      if (!pick) return;
      // Replace the typed "#sal" (from its # to the caret) with the room's link.
      selectionEnd = caret;
      caret = places.start;
      field?.insert(`${roomReference(pick)} `);
      return;
    }
    const pick = mentions?.items[index];
    if (!mentions || !pick) return;
    // Replace the typed "@par" (from its @ to the caret) with the handle.
    selectionEnd = caret;
    caret = mentions.start;
    field?.insert(`@${pick.handle} `);
  }
  // A thread whose tasks are all done waits on a person to mark it done (Gimenes #4249): the empty composer offers
  // "Marcar como concluída" and Tab writes it; the server marks the thread done when a person sends it.
  const offersDone = $derived.by(() => {
    if (thread === "main") return false;
    const epic = room.epics.find((item) => item.id === thread);
    return (
      !!epic &&
      !epic.done &&
      epic.tasks.length > 0 &&
      epic.tasks.every((task) => task.status === "done")
    );
  });
  function keydown(event: KeyboardEvent) {
    if (
      offersDone &&
      event.key === "Tab" &&
      !event.shiftKey &&
      !items.length &&
      !/\S/.test($draft.text)
    ) {
      event.preventDefault();
      caret = 0;
      selectionEnd = $draft.text.length;
      field?.insert(vb.t(MARK_DONE.pt));
      return true;
    }
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
    // ArrowUp in an empty composer edits your last message here, in place (like Discord).
    if (
      event.key === "ArrowUp" &&
      !event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.isComposing &&
      !$draft.text &&
      !$draft.attachments.length
    ) {
      const last = lastEditable(room, thread);
      if (last) {
        event.preventDefault();
        startEditing(room.id, last.id);
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
      root?.closest<HTMLElement>("[data-room-layout]") ?? root?.closest("main");
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
    // When you enter a room, a DM or a thread, the composer takes the focus,
    // so you can type at once. It also mounts again when a panel (the Inbox)
    // closes in the same thread: then the focus goes back to the button that
    // opened the panel. On a touch screen a focus opens the keyboard over the
    // messages, and the phone layout hides its tab bar while the composer has
    // the focus, so there you tap the field yourself. Do not take the focus
    // from another field or an open dialog.
    const scope = `${room.me}:${room.id}:${thread}`,
      entered = scope !== lastEntered;
    lastEntered = scope;
    if (
      entered &&
      !window.matchMedia("(pointer: coarse)").matches &&
      !window.matchMedia(MOBILE_QUERY).matches
    )
      void field?.focus(undefined, () => {
        const focused = document.activeElement;
        return (
          active &&
          !hidden &&
          allowed &&
          !(
            focused instanceof HTMLElement &&
            (focused.isContentEditable ||
              /^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName) ||
              focused.closest("[role=dialog],[role=alertdialog]"))
          )
        );
      });
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
  data-composer
  {hidden}
  class={hidden
    ? "hidden"
    : [
        "relative flex shrink-0 flex-col gap-2 bg-background font-sans text-sm text-foreground",
        COMPOSER_FRAME,
      ]}
>
  {#if dragging}<div
      role="status"
      class="rounded-control border-2 border-dashed border-primary bg-primary/10 p-4 text-center"
    >
      {vb.t("Anexar arquivo")}
    </div>{/if}
  {#if items.length}<div
      id={`${uid}-mentions`}
      role="listbox"
      aria-label={emojis
        ? vb.t("Emoji")
        : places
          ? vb.t("Mencionar sala")
          : vb.t("Mencionar")}
      class="absolute bottom-full left-3 z-20 max-h-64 max-w-[calc(100%-1.5rem)] overflow-auto rounded-xl bg-popover p-1 text-popover-foreground shadow-edge-raised"
    >
      {#if emojis}{#each emojis.items as item, index}<button
            id={`${uid}-mention-${index}`}
            type="button"
            role="option"
            aria-selected={selected === index}
            data-emoji-pick={item.emoji}
            class={selected === index
              ? "flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-lg bg-accent px-2 py-1.5 text-left"
              : "flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-accent"}
            onpointerdown={(event) => {
              event.preventDefault();
              choose(index);
            }}
            onclick={() => choose(index)}
            ><span aria-hidden="true" class="w-6 text-center text-lg"
              >{item.emoji}</span
            ><span class="text-muted-foreground">:{item.name}:</span></button
          >{/each}{:else if places}{#each places.items as item, index}<button
            id={`${uid}-mention-${index}`}
            type="button"
            role="option"
            aria-selected={selected === index}
            data-room-pick={item.kind === "room"
              ? item.id
              : `${room.id}?t=${item.id}`}
            class={selected === index
              ? "flex min-h-8 w-full min-w-56 cursor-pointer items-center gap-2 rounded-lg bg-accent px-2 py-1.5 text-left"
              : "flex min-h-8 w-full min-w-56 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-accent"}
            onpointerdown={(event) => {
              event.preventDefault();
              choose(index);
            }}
            onclick={() => choose(index)}
            ><span
              aria-hidden="true"
              class="flex size-4 shrink-0 items-center justify-center"
              >{#if item.kind === "room"}<RoomMark
                  title={item.title}
                  src={item.icon
                    ? `/api/books/${encodeURIComponent(item.id)}/icon?v=${item.icon}`
                    : undefined}
                  size="2xs"
                />{:else}<Icon
                  icon="message-circle-01"
                  size={16}
                  class="text-muted-foreground"
                />{/if}</span
            >{#if item.kind === "thread"}<span
                class="min-w-12 shrink-[999] truncate font-medium text-muted-foreground"
                >{item.room}</span
              ><Icon
                icon="chevron-right"
                size={14}
                class="-mx-0.5 shrink-0 text-muted-foreground"
              />{/if}<span class="min-w-0 truncate font-medium"
              >{item.title}</span
            ></button
          >{/each}{:else}
        {#each mentions?.items || [] as item, index}<button
            id={`${uid}-mention-${index}`}
            type="button"
            role="option"
            aria-selected={selected === index}
            class={selected === index
              ? "flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-lg bg-accent px-2 py-1.5 text-left"
              : "flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-accent"}
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
                email={item.email}
                version={vb.avatarVersion(item.email)}
              />{:else}<Avatar
                shape="circle"
                size="xs"
                aria-hidden="true"
                fallback="@"
              />{/if}{#if item.email && !item.agent}<b class="font-medium"
                >{item.label}</b
              ><small class="text-muted-foreground">@{item.handle}</small
              >{:else}<b>@{item.handle}</b><small class="text-muted-foreground"
                >{vb.t(item.label)}</small
              >{/if}</button
          >{/each}{/if}
    </div>{/if}
  {#if refining || voiceWaiting}<p
      role="status"
      data-composer-transcribing
      class="m-0 flex items-center gap-2 text-xs text-muted-foreground"
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
      if (!canInteract()) return;
      if (
        /\S/.test($draft.text) ||
        $draft.quotes.length ||
        $draft.attachments.length
      )
        onsend?.();
      void entry.submit();
    }}
    onkeydown={keydown}
    mention={(handle) => knownMention(handle, room, vb.knownNames)}
    t={vb.t}
    locale={vb.locale || "pt-BR"}
    id="input"
    label={vb.t("Mensagem…")}
    placeholder={offersDone
      ? vb.t("{action} (Tab)", { action: vb.t(MARK_DONE.pt) })
      : vb.t("Mensagem…")}
    disabled={!allowed || hidden}
    enabled={() => canInteract()}
    {busy}
    pending={$draft.phase === "pending"}
    ready={/\S/.test($draft.text) ||
      $draft.quotes.length > 0 ||
      $draft.attachments.length > 0}
    sendDisabled={(!/\S/.test($draft.text) &&
      !$draft.quotes.length &&
      !$draft.attachments.length) ||
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
    {#snippet above()}
      {#if $draft.replyId}<div
          data-composer-reply
          class="flex items-center gap-2 border-b border-border py-1 pr-1.5 pl-3.5 text-xs text-muted-foreground transition-[opacity,translate] duration-150 ease-[var(--vb-ease-out-cubic)] starting:translate-y-1 starting:opacity-0"
        >
          <Icon icon="reverse-left" size={14} class="shrink-0" />
          {#if reply}<span class="flex min-w-0 flex-1 items-baseline gap-1.5"
              ><span class="shrink-0 whitespace-nowrap"
                ><span class="hidden md:inline"
                  >{vb.t("Respondendo a")}&nbsp;</span
                ><b class="font-semibold text-foreground"
                  >{reply.author === "ai"
                    ? "@vibe"
                    : reply.kind === "agent"
                      ? vb.t("{via} de {who}", {
                          via: "Agent",
                          who: vb.name(reply.author),
                        })
                      : vb.name(reply.author)}</b
                ></span
              ><span class="min-w-0 truncate"
                >· {!reply.text && reply.poll
                  ? vb.t("votação")
                  : quoteSnippet(reply)}</span
              ></span
            >{:else}<span class="min-w-0 flex-1 truncate"
              >{vb.t("A mensagem não está mais disponível.")}</span
            >{/if}
          <IconButton
            label={vb.t("Cancelar resposta")}
            size="icon-xs"
            class="shrink-0 text-muted-foreground hover:bg-secondary-hover hover:text-foreground"
            onclick={(event) => {
              if (canInteract(event)) entry.clearReply();
            }}><Icon icon="x" size={14} /></IconButton
          >
        </div>{/if}
      <!-- Passages an app quoted (the content-os reader): chips, like a reference in Notion. Each goes before the
           typed text when the message is sent. -->
      {#if $draft.quotes.length}<div
          data-composer-quotes
          class="flex flex-wrap gap-1.5 px-2 pt-2"
        >
          {#each $draft.quotes as quote, index (quote.text)}<Chip
              data-composer-quote
              title={quote.text}
              class="max-w-full pr-0.5 transition-[opacity,scale] duration-150 ease-[var(--vb-ease-out-cubic)] starting:scale-95 starting:opacity-0"
              ><Icon icon="align-left" size={12} /><span
                class="min-w-0 truncate text-foreground">{quote.label}</span
              ><IconButton
                label={vb.t("Remover trecho")}
                size="icon-xs"
                class="size-5 shrink-0 rounded-full text-muted-foreground hover:bg-secondary-hover hover:text-foreground"
                onclick={(event) => {
                  if (canInteract(event)) entry.removeQuote(index);
                }}><Icon icon="x" size={12} /></IconButton
              ></Chip
            >{/each}
        </div>{/if}
      {#if $draft.attachments.length}<div
          class="flex flex-wrap gap-2 px-2 pt-2"
        >
          {#each $draft.attachments as item (item.id)}{@const image =
              preview(item)}
            <div
              data-composer-attachment={item.id}
              class="relative flex w-32 flex-col gap-1 rounded-control bg-card p-2 shadow-edge transition-[opacity,scale] duration-150 ease-[var(--vb-ease-out-cubic)] starting:scale-95 starting:opacity-0"
            >
              {#if image}<img
                  src={image}
                  alt={item.name}
                  class="h-20 w-full rounded-sm object-cover"
                />{:else}<Icon icon="file-02" size={16} />{/if}<span
                class="break-words text-xs">{item.name}</span
              ><span role="status" class="text-xs text-muted-foreground"
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
                class="absolute right-1 top-1 rounded-full bg-card shadow-edge"
                onclick={(event) => {
                  if (canInteract(event)) entry.removeFile(item.id);
                }}><Icon icon="x" size={14} /></IconButton
              >
            </div>{/each}
        </div>{/if}
    {/snippet}
    {#snippet menu(close)}<Button
        variant="menu"
        role="menuitem"
        onclick={(event) => {
          if (!canInteract(event)) return;
          close();
          fileInput?.click();
        }}
        ><Icon icon="paperclip" />{vb.t("Anexar arquivo")}
        <small>{vb.t("ou Cmd+V")}</small></Button
      ><Button
        variant="menu"
        role="menuitem"
        onclick={(event) => {
          if (!canInteract(event)) return;
          close();
          const before = $draft.text.slice(0, caret);
          field?.insert(before && !/\s$/.test(before) ? " @" : "@");
          mentionClosed = false;
        }}><Icon icon="at-sign" />{vb.t("Mencionar alguém")}</Button
      ><Button
        variant="menu"
        role="menuitem"
        onclick={(event) => {
          if (!canInteract(event)) return;
          close();
          const before = $draft.text.slice(0, caret);
          field?.insert(before && !/\s$/.test(before) ? " #" : "#");
          mentionClosed = false;
        }}><Icon icon="hash-02" />{vb.t("Mencionar sala")}</Button
      ><Button
        variant="menu"
        role="menuitem"
        onclick={(event) => {
          if (!canInteract(event)) return;
          close();
          poll = true;
        }}><Icon icon="bar-chart-square-02" />{vb.t("Criar votação")}</Button
      >{/snippet}
  </ChatField>
  <input
    bind:this={fileInput}
    type="file"
    class="hidden"
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
      class="m-0 text-xs text-muted-foreground"
    >
      {vb.t(
        "Ainda sem confirmação. Confira a sala antes de enviar novamente.",
      )}{#if candidateTarget}<Button
          variant="link"
          size="sm"
          class="h-auto text-xs text-foreground underline decoration-current/35 underline-offset-4 hover:decoration-current"
          onclick={(event) => {
            if (canInteract(event) && candidateTarget)
              navigate(candidateTarget);
          }}>{vb.t("Ver mensagem correspondente")}</Button
        >{/if}
    </p>
    <div class="flex flex-wrap gap-2">
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
      class="m-0 break-words text-xs text-destructive"
    >
      {composerError($draft.error, vb.t)}
    </p>{/if}
  <!-- A plain send needs no line under the chat (the message showing up says it): "Sent" is for screen readers only. -->
  {#if $draft.notice}<p
      role="status"
      class={$draft.notice === "sent"
        ? "sr-only"
        : "m-0 text-xs text-muted-foreground"}
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
      class="m-0 text-xs text-destructive"
    >
      {vb.t("Ouvindo… Escape para parar.")}
    </p>{/if}
  {#if voiceIssue}<p role="status" class="m-0 text-xs text-destructive">
      {voiceIssue === "not-allowed"
        ? vb.t("O navegador não deixou usar o microfone.")
        : voiceIssue === "invalid-result"
          ? vb.t("O ditado foi interrompido. Seu rascunho foi mantido.")
          : vb.t("Não foi possível iniciar o ditado.")}
    </p>{/if}
  <OrphanDrafts {room} {drafts} {vb} />
  <PollCreateDialog {entry} {vb} bind:open={poll} />
</section>
