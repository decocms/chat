<script lang="ts">
  import { visibleMessage, messageById } from "../chat/privacy";
  import { get } from "svelte/store";
  import { browserSpeech, browserSpeechClock } from "./speech";
  import { createDictationController } from "./dictation";
  import { browserFireCapture } from "./fireAudio";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import type { ComposerProps } from "./types";
  import type { PendingAttachment } from "./model";
  import {
    FILE_ACCEPT,
    insertAt,
    mentionPicks,
    quoteSnippet,
    composerError,
  } from "./model";
  import Textarea from "../../lib/studio/Textarea.svelte";
  import { cn } from "../../lib/studio/utils";
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import Avatar from "../../lib/studio/Avatar.svelte";
  import AgentMark from "../../lib/components/AgentMark.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import {
    FaceSmile,
    File02,
    Microphone01,
    Plus,
    ReverseLeft,
    X,
  } from "../../lib/studio/icons";
  import OrphanDrafts from "./OrphanDrafts.svelte";
  import EmojiPicker from "./EmojiPicker.svelte";
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
    voiceIssue = $state("");
  let active = true,
    textarea = $state<HTMLTextAreaElement | null>(null),
    fileInput = $state<HTMLInputElement | null>(null),
    root = $state<HTMLElement | null>(null),
    menu = $state<HTMLElement | null>(null),
    plus = $state(false),
    emoji = $state(false),
    poll = $state(false),
    dragging = $state(false),
    caret = $state(0),
    selectionEnd = $state(0),
    pickAt = $state(0),
    mentionClosed = $state(false);
  const ownedSpeechFactory = untrack(() =>
    speechFactory === undefined
      ? browserSpeech(window)
      : speechFactory || undefined,
  );
  let refining = $state(false),
    voiceWaiting = $state(false);
  const ownedCaptureFactory = untrack(() =>
    mediaFactory === undefined
      ? browserFireCapture(window)
      : mediaFactory || undefined,
  );
  const ownedVoicePort = untrack(() => voicePort);
  const speech = createDictationController({
    capture: ownedCaptureFactory,
    transcribe: ownedVoicePort
      ? (audio, signal) => ownedVoicePort.transcribe(audio, signal)
      : undefined,
    clock: browserSpeechClock,
    current: () =>
      canInteract() && !busy && (!ownedVoicePort || ownedVoicePort.current()),
    refining: (value) => {
      if (active) refining = value;
    },
    factory: ownedSpeechFactory,
    coarse: () => window.matchMedia("(pointer: coarse)").matches,
    locale: untrack(() => vb.locale || "pt-BR"),
    read: () => {
      const current = get(entry.state);
      return {
        text: current.text,
        revision: current.revision,
        start: textarea?.selectionStart ?? current.text.length,
        end: textarea?.selectionEnd ?? current.text.length,
      };
    },
    write: (text, at) => {
      if (!canInteract()) return;
      entry.edit(text);
      if (textarea) {
        textarea.value = text;
        if (at !== undefined) textarea.setSelectionRange(at, at);
      }
      readCaret();
      mentionClosed = true;
    },
    canStart: () =>
      canInteract() &&
      !voiceWaiting &&
      document.activeElement === textarea &&
      !busy &&
      !document.querySelector(
        '[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"],dialog[open]',
      ),
    recording: (value) => {
      if (active) dictating = value;
    },
    error: (value) => {
      if (active) voiceIssue = value;
    },
    ended: () => {
      void focus(
        undefined,
        () =>
          !document.querySelector(
            '[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"],dialog[open]',
          ),
      );
    },
  });
  const detachVoice = untrack(() =>
    ownedVoicePort?.beforeLeave(() => speech.cancel()),
  );
  $effect(() => {
    $draft.revision;
    untrack(() => speech.sync());
  });
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
  const items = $derived(mentions?.items || []);
  const selected = $derived(items.length ? pickAt % items.length : 0);
  const busy = $derived(
    $draft.phase === "pending" || $draft.phase === "unconfirmed",
  );
  $effect(() => {
    if (hidden) {
      speech.cancel();
      plus = false;
      emoji = false;
      poll = false;
      mentionClosed = true;
    }
  });
  $effect(() => {
    const snapshot = room,
      send = request,
      put = upload;
    untrack(() => {
      entry.sync(snapshot, send, put);
      speech.sync();
    });
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
  async function focus(at?: number, permit?: () => boolean) {
    await tick();
    if (
      !active ||
      hidden ||
      !allowed ||
      !textarea?.isConnected ||
      permit?.() === false
    )
      return;
    textarea.focus();
    if (at !== undefined) textarea.setSelectionRange(at, at);
    caret = textarea.selectionStart;
    selectionEnd = textarea.selectionEnd;
  }
  const detachFocus = entry.attachFocus(() => {
    void focus();
  });
  onDestroy(() => {
    active = false;
    speech.dispose();
    detachVoice?.();
    clearTimeout(blurTimer);
    detachFocus();
    for (const preview of previews.values()) URL.revokeObjectURL(preview.url);
    previews.clear();
  });
  let blurTimer: ReturnType<typeof setTimeout> | undefined;
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
  async function submit() {
    if (!canInteract() || voiceWaiting) return;
    if (!speech.working()) {
      speech.cancel();
      void entry.submit();
      return;
    }
    voiceWaiting = true;
    try {
      const snapshot = await speech.finish();
      if (
        !snapshot ||
        !canInteract() ||
        (ownedVoicePort && !ownedVoicePort.current())
      )
        return;
      const latest = get(entry.state);
      if (
        latest.revision !== snapshot.revision ||
        latest.text !== snapshot.text
      )
        return;
      speech.cancel();
      if (
        canInteract() &&
        (!ownedVoicePort || ownedVoicePort.current()) &&
        get(entry.state).revision === snapshot.revision
      )
        void entry.submit();
    } finally {
      if (active) voiceWaiting = false;
    }
  }
  function readCaret() {
    if (textarea) {
      caret = textarea.selectionStart;
      selectionEnd = textarea.selectionEnd;
    }
  }
  function insert(value: string) {
    if (!active || !allowed || hidden) return;
    const result = insertAt($draft.text, caret, selectionEnd, value);
    entry.edit(result.text);
    mentionClosed = true;
    void focus(result.caret);
  }
  function choose(index: number) {
    const pick = items[index];
    if (!active || !allowed || !mentions || !pick) return;
    const result = insertAt(
      $draft.text,
      mentions.start,
      caret,
      `@${pick.handle} `,
    );
    entry.edit(result.text);
    mentionClosed = true;
    void focus(result.caret);
  }
  async function openMenu(keyboard = false) {
    if (!canInteract()) return;
    speech.cancel();
    readCaret();
    plus = true;
    if (keyboard) {
      await tick();
      if (canInteract())
        menu?.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }
  function menuKeydown(event: KeyboardEvent) {
    if (!canInteract(event)) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      plus = false;
      root?.querySelector<HTMLButtonElement>("[data-composer-more]")?.focus();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const buttons = [
        ...(menu?.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        ) || []),
      ];
      if (!buttons.length) return;
      const current = buttons.findIndex(
        (button) => button === document.activeElement,
      );
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? buttons.length - 1
            : (current +
                (event.key === "ArrowDown" ? 1 : buttons.length - 1) +
                buttons.length) %
              buttons.length;
      buttons[next].focus();
    }
  }
  function keydown(event: KeyboardEvent) {
    if (!canInteract(event)) return;
    if (event.key === "Escape" && dictating) {
      event.preventDefault();
      event.stopPropagation();
      speech.cancel();
      return;
    }
    if (speech.keydown(event)) return;
    if (items.length) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        pickAt =
          (selected + (event.key === "ArrowDown" ? 1 : items.length - 1)) %
          items.length;
        return;
      }
      if (
        (event.key === "Enter" || event.key === "Tab") &&
        !event.isComposing
      ) {
        event.preventDefault();
        choose(selected);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        mentionClosed = true;
        return;
      }
    }
    if (event.key === "Escape" && $draft.replyId) {
      event.preventDefault();
      event.stopPropagation();
      entry.clearReply();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      submit();
    }
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
        void focus();
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
        void focus();
      }
      dragging = false;
    };
    const outside = (event: PointerEvent) => {
      if (
        plus &&
        event.target instanceof Node &&
        !menu?.contains(event.target) &&
        !root?.querySelector("[data-composer-more]")?.contains(event.target)
      )
        plus = false;
    };
    const cancelVoice = () => speech.cancel();
    const voiceEscape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        canInteract() &&
        !document.querySelector(
          '[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"],dialog[open]',
        )
      )
        speech.cancel();
    };
    const visibility = () => {
      if (document.visibilityState !== "visible") speech.cancel();
    };
    document.addEventListener("keydown", voiceEscape, true);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", cancelVoice);
    document.addEventListener("paste", paste);
    document.addEventListener("pointerdown", outside);
    main?.addEventListener("dragover", drag);
    main?.addEventListener("dragleave", leave);
    main?.addEventListener("drop", drop);
    return () => {
      document.removeEventListener("keydown", voiceEscape, true);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", cancelVoice);
      document.removeEventListener("paste", paste);
      document.removeEventListener("pointerdown", outside);
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
      aria-label={vb.t("Mencionar")}
      class="tw:absolute tw:bottom-full tw:left-3 tw:z-20 tw:max-h-64 tw:max-w-[calc(100%-1.5rem)] tw:overflow-auto tw:rounded-xl tw:bg-popover tw:p-1 tw:text-popover-foreground tw:shadow-edge-raised"
    >
      {#each items as item, index}<button
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
            />{/if}<b>@{item.handle}</b><small class="tw:text-muted-foreground"
            >{vb.t(item.label)}</small
          ></button
        >{/each}
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
  <form
    class="tw:flex tw:items-end tw:gap-0.5 tw:rounded-[18px] tw:bg-card tw:py-1.5 tw:pr-1.5 tw:pl-1 tw:shadow-[inset_0_0_0_1px_var(--vb-hairline),0_4px_16px_0_#0000000d] tw:transition-shadow tw:duration-150 tw:ease-[var(--vb-ease-out-cubic)] tw:focus-within:shadow-[inset_0_0_0_1px_var(--vb-input),0_6px_20px_0_#00000014]"
    onsubmit={(event) => {
      event.preventDefault();
      submit();
    }}
  >
    <IconButton
      label={vb.t("Emoji")}
      size="icon"
      class="tw:text-muted-foreground tw:hover:text-foreground"
      disabled={voiceWaiting || !allowed}
      onclick={(event) => {
        if (canInteract(event)) {
          speech.cancel();
          readCaret();
          emoji = true;
        }
      }}><Icon icon={FaceSmile} size={16} /></IconButton
    >
    <div class="tw:relative">
      <IconButton
        label={vb.t("Mais opções")}
        size="icon"
        class="tw:text-muted-foreground tw:hover:text-foreground tw:aria-expanded:bg-accent tw:aria-expanded:text-foreground"
        data-composer-more
        aria-haspopup="menu"
        aria-expanded={plus}
        disabled={voiceWaiting || !allowed}
        onpointerdown={(event) => {
          if (document.activeElement === textarea) event.preventDefault();
        }}
        onkeydown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            void openMenu(true);
          }
        }}
        onclick={(event) => {
          if (!canInteract(event)) return;
          if (plus) plus = false;
          else void openMenu(event.detail === 0);
        }}><Icon icon={Plus} size={16} /></IconButton
      >
      {#if plus}<div
          bind:this={menu}
          role="menu"
          tabindex="-1"
          class="tw:absolute tw:bottom-full tw:left-0 tw:z-20 tw:mb-2 tw:grid tw:min-w-56 tw:gap-0.5 tw:rounded-xl tw:bg-popover tw:p-1 tw:text-popover-foreground tw:shadow-edge-raised"
          onkeydown={menuKeydown}
        >
          <Button
            variant="menu"
            role="menuitem"
            onclick={(event) => {
              if (!canInteract(event)) return;
              plus = false;
              fileInput?.click();
            }}
            >{vb.t("Anexar arquivo")} <small>{vb.t("ou Cmd+V")}</small></Button
          ><Button
            variant="menu"
            role="menuitem"
            onclick={(event) => {
              if (!canInteract(event)) return;
              plus = false;
              const before = $draft.text.slice(0, caret);
              insert(before && !/\s$/.test(before) ? " @" : "@");
              mentionClosed = false;
            }}>{vb.t("Mencionar alguém")} @</Button
          ><Button
            variant="menu"
            role="menuitem"
            onclick={(event) => {
              if (!canInteract(event)) return;
              plus = false;
              poll = true;
            }}>{vb.t("Criar votação")}</Button
          >
        </div>{/if}
    </div>
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
    <Textarea
      bind:ref={textarea}
      id="input"
      rows={Math.min(6, $draft.text.split("\n").length)}
      aria-label={vb.t("Mensagem…")}
      placeholder={vb.t("Mensagem…")}
      value={$draft.text}
      disabled={voiceWaiting || !allowed}
      aria-autocomplete="list"
      aria-controls={items.length ? `${uid}-mentions` : undefined}
      aria-activedescendant={items.length
        ? `${uid}-mention-${selected}`
        : undefined}
      class={cn(
        "tw:block tw:max-h-40 tw:min-h-8 tw:min-w-0 tw:flex-1 tw:resize-none tw:rounded-lg tw:bg-transparent tw:px-1.5 tw:py-1.5 tw:text-[15px] tw:leading-5 tw:shadow-none tw:[field-sizing:content] tw:hover:bg-transparent tw:focus-visible:outline-none",
        dictating && "tw:ring-2 tw:ring-destructive",
      )}
      oninput={(event) => {
        if (!canInteract(event)) return;
        speech.cancel();
        clearTimeout(blurTimer);
        entry.edit(event.currentTarget.value);
        readCaret();
        pickAt = 0;
        mentionClosed = false;
      }}
      onselect={readCaret}
      onclick={readCaret}
      onkeyup={(event) => {
        speech.keyup(event);
        readCaret();
      }}
      onkeydown={keydown}
      onfocus={() => clearTimeout(blurTimer)}
      onblur={() => {
        if (!voiceWaiting) speech.cancel();
        blurTimer = setTimeout(() => {
          if (active) mentionClosed = true;
        }, 100);
      }}
    />
    <!-- The mic sits right before Enviar, as in the classic app (Gui #2896). -->
    {#if speech.supported}<IconButton
        size="icon"
        aria-busy={refining || undefined}
        label={vb.t("Ditar mensagem")}
        title={vb.t("Toque pra ditar (ou segure espaço na caixa)")}
        aria-pressed={dictating}
        class={dictating
          ? "tw:bg-destructive tw:text-destructive-foreground tw:hover:bg-destructive/85 tw:hover:text-destructive-foreground"
          : "tw:text-muted-foreground tw:hover:text-foreground"}
        disabled={voiceWaiting || !allowed || busy || refining}
        onpointerdown={(event) => {
          if (canInteract(event)) event.preventDefault();
        }}
        onclick={(event) => {
          if (!canInteract(event)) return;
          textarea?.focus();
          if (dictating) speech.stop();
          else void speech.start();
        }}
        >{#if refining}<Spinner size="xs" />{:else}<Icon
            icon={Microphone01}
            size={16}
          />{/if}</IconButton
      >{/if}
    <Button
      type="submit"
      data-composer-send
      disabled={voiceWaiting ||
        !allowed ||
        busy ||
        $draft.attachments.some(
          (item) => item.phase === "queued" || item.phase === "uploading",
        )}
      aria-busy={$draft.phase === "pending" || undefined}
      class="tw:rounded-full"
      onmousedown={(event) => event.preventDefault()}
      ontouchend={(event) => {
        if (!busy && allowed) {
          event.preventDefault();
          submit();
        }
      }}
      >{#if $draft.phase === "pending"}<Spinner size="2xs" />{/if}{vb.t(
        "Enviar",
      )}</Button
    >
  </form>
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
  {#if $draft.notice}<p
      role="status"
      class="tw:m-0 tw:text-xs tw:text-muted-foreground"
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
  <EmojiPicker {vb} bind:open={emoji} onpick={insert} /><PollCreateDialog
    {entry}
    {vb}
    bind:open={poll}
  />
</section>
