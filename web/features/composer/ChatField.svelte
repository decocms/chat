<script lang="ts">
  import type { Snippet } from "svelte";
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import type { HTMLTextareaAttributes } from "svelte/elements";
  import Textarea from "../../lib/studio/Textarea.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { cn } from "../../lib/studio/utils";
  import {
    browserSpeech,
    browserSpeechClock,
    type SpeechFactory,
  } from "./speech";
  import { createDictationController } from "./dictation";
  import type { FireCaptureFactory } from "./fireAudio";
  import { insertAt, mentionKey, mentionSegments } from "./model";
  import EmojiPicker from "./EmojiPicker.svelte";

  /** The one chat box: the room's composer and the home's ask box both render it,
   *  so they look and behave the same: emoji, + menu, the field, dictation and send. */
  let {
    value,
    onedit,
    onsubmit,
    t,
    locale = "pt-BR",
    placeholder,
    label = placeholder,
    id,
    rows,
    maxlength,
    disabled = false,
    sendDisabled = false,
    busy = false,
    pending = false,
    revision,
    enabled = () => true,
    onkeydown,
    menu,
    inside,
    above,
    ready = undefined,
    speechFactory,
    captureFactory,
    transcribe,
    textarea = $bindable(null),
    caret = $bindable(0),
    selectionEnd = $bindable(0),
    dictating = $bindable(false),
    refining = $bindable(false),
    waiting = $bindable(false),
    voiceIssue = $bindable(""),
    menuOpen = $bindable(false),
    inputProps = {},
    oninputtext,
    onblurfield,
    mention,
  }: {
    /** The text in the field. */
    value: string;
    /** Every change to the text: typing, an emoji, dictation. */
    onedit: (text: string) => void;
    /** Enter or the send button, after any dictation in progress has settled. */
    onsubmit: () => void;
    t: (text: string, vars?: Record<string, string | number>) => string;
    locale?: string;
    placeholder: string;
    label?: string;
    id?: string;
    /** Visible rows; defaults to the text's line count, up to 6. */
    rows?: number;
    maxlength?: number;
    /** Turns the whole box off. */
    disabled?: boolean;
    /** Turns only the send button off. */
    sendDisabled?: boolean;
    /** Something is on its way: dictation and send wait. */
    busy?: boolean;
    /** Shows a spinner in the send button. */
    pending?: boolean;
    /** The draft's revision; dictation stops when it moves under it. Defaults to counting text changes. */
    revision?: number;
    /** Extra guard checked before acting (the room fences an outgoing composer with it). */
    enabled?: () => boolean;
    /** Runs before Enter sends; return true when it handled the key. */
    onkeydown?: (event: KeyboardEvent) => boolean;
    /** Items of the + menu; `close` closes it, `trigger` is the + button (stays in the page,
     *  so a dialog opened from the menu can return focus to it). Without it the + is disabled. */
    menu?: Snippet<[close: () => void, trigger: HTMLElement | null]>;
    /** Shown at the right end of the field while it's empty (the room's "O que precisa de mim aqui?"). */
    inside?: Snippet;
    /** Shown inside the field, above the text: the reply strip and the attachments of the room's composer. */
    above?: Snippet;
    /** There is something to send: the send button shows (on phones it takes the mic's place). Defaults to text in the field. */
    ready?: boolean;
    speechFactory?: SpeechFactory | null;
    captureFactory?: FireCaptureFactory | null;
    transcribe?: (audio: Blob, signal: AbortSignal) => Promise<string>;
    textarea?: HTMLTextAreaElement | null;
    caret?: number;
    selectionEnd?: number;
    dictating?: boolean;
    refining?: boolean;
    waiting?: boolean;
    voiceIssue?: string;
    menuOpen?: boolean;
    inputProps?: Omit<
      HTMLTextareaAttributes,
      "value" | "class" | "style" | "children"
    >;
    /** After a typed change (not dictation/emoji). */
    oninputtext?: () => void;
    onblurfield?: () => void;
    /** Whether `@handle` names someone here: known mentions are tinted behind the text and
     *  Backspace, Delete and the arrows treat each one as a single unit. */
    mention?: (handle: string) => boolean;
  } = $props();

  let active = true,
    root = $state<HTMLFormElement | null>(null),
    menuNode = $state<HTMLElement | null>(null),
    more = $state<HTMLElement | null>(null),
    emoji = $state(false),
    seen = untrack(() => value),
    counted = 0,
    mirror = $state<HTMLElement | null>(null),
    // Where the last typed character went: Backspace right there edits a hand-typed mention letter by letter.
    typedAt = -1;
  const segments = $derived(mention ? mentionSegments(value, mention) : []);
  const tinted = $derived(segments.some((segment) => segment.mention));
  // The highlight layer and the textarea share these classes (type, padding), so the mirror's
  // text wraps exactly where the field's does.
  const FIELD_TYPE =
    "px-1.5 py-1.5 text-[15px] pointer-coarse:text-[16px] leading-5 [scrollbar-gutter:stable]";
  function mentionKeydown(event: KeyboardEvent) {
    if (
      !mention ||
      !textarea ||
      event.isComposing ||
      event.shiftKey ||
      event.altKey ||
      event.metaKey ||
      event.ctrlKey ||
      textarea.selectionStart !== textarea.selectionEnd
    )
      return false;
    const at = textarea.selectionStart,
      step = mentionKey(value, at, event.key, mention, typedAt === at);
    if (!step) return false;
    if ("select" in step) {
      // Leave the key to the browser: it deletes the selection, with undo and an input event.
      textarea.setSelectionRange(step.select[0], step.select[1]);
      return false;
    }
    event.preventDefault();
    textarea.setSelectionRange(step.move, step.move);
    readCaret();
    return true;
  }
  const OPEN_DIALOG =
    '[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"],dialog[open]';
  // Without a draft revision, every change of the text counts as one. Counted when read
  // (not in an effect), so dictation's own write is already counted when it reads back.
  const currentRevision = () => {
    if (revision !== undefined) return revision;
    if (value !== seen) {
      seen = value;
      counted++;
    }
    return counted;
  };
  // Counts at most 6 line breaks, so a long text costs nothing per keystroke (the field sizes itself to the content).
  const lines = $derived.by(() => {
    if (rows !== undefined) return rows;
    let count = 1;
    for (let at = value.indexOf("\n"); at !== -1 && count < 6; count++)
      at = value.indexOf("\n", at + 1);
    return count;
  });
  const filled = $derived(ready ?? /\S/.test(value));
  // `enabled` goes first: the room's fence must run before any of its live props are read.
  const ok = () => active && enabled() && !disabled && !!root?.isConnected;

  const speech = createDictationController({
    capture: untrack(() =>
      captureFactory === undefined ? undefined : captureFactory || undefined,
    ),
    transcribe: untrack(() => transcribe),
    clock: browserSpeechClock,
    current: () => ok() && !busy,
    refining: (on) => {
      if (active) refining = on;
    },
    factory: untrack(() =>
      speechFactory === undefined
        ? browserSpeech(window)
        : speechFactory || undefined,
    ),
    coarse: () => window.matchMedia("(pointer: coarse)").matches,
    locale: untrack(() => locale),
    read: () => ({
      text: value,
      revision: currentRevision(),
      start: textarea?.selectionStart ?? value.length,
      end: textarea?.selectionEnd ?? value.length,
    }),
    write: (text, at) => {
      if (!ok()) return;
      onedit(text);
      if (textarea) {
        textarea.value = text;
        if (at !== undefined) textarea.setSelectionRange(at, at);
      }
      readCaret();
    },
    canStart: () =>
      ok() &&
      !waiting &&
      document.activeElement === textarea &&
      !busy &&
      !document.querySelector(OPEN_DIALOG),
    recording: (on) => {
      if (active) dictating = on;
    },
    error: (issue) => {
      if (active) voiceIssue = issue;
    },
    ended: () => {
      void focus(undefined, () => !document.querySelector(OPEN_DIALOG));
    },
  });
  $effect(() => {
    value;
    revision;
    untrack(() => speech.sync());
  });
  $effect(() => {
    if (disabled) untrack(() => cancel());
  });

  /** Stops dictation without sending. */
  export function cancel() {
    speech.cancel();
    menuOpen = false;
    emoji = false;
  }
  /** Puts `text` at the caret (or over the selection) and focuses the field. */
  export function insert(text: string) {
    if (!ok()) return;
    const result = insertAt(value, caret, selectionEnd, text);
    onedit(result.text);
    void focus(result.caret);
  }
  /** Focuses the field, optionally moving the caret. */
  export async function focus(at?: number, permit?: () => boolean) {
    await tick();
    if (!ok() || !textarea?.isConnected || permit?.() === false) return;
    textarea.focus();
    if (at !== undefined) textarea.setSelectionRange(at, at);
    readCaret();
  }
  function readCaret() {
    if (textarea) {
      caret = textarea.selectionStart;
      selectionEnd = textarea.selectionEnd;
    }
  }
  async function submit() {
    if (!ok() || waiting) return;
    if (!speech.working()) {
      speech.cancel();
      onsubmit();
      return;
    }
    waiting = true;
    try {
      const snapshot = await speech.finish();
      if (!snapshot || !ok()) return;
      if (currentRevision() !== snapshot.revision || value !== snapshot.text)
        return;
      speech.cancel();
      if (ok() && currentRevision() === snapshot.revision) onsubmit();
    } finally {
      if (active) waiting = false;
    }
  }
  async function openMenu(keyboard = false) {
    if (!ok() || !menu) return;
    speech.cancel();
    readCaret();
    menuOpen = true;
    if (keyboard) {
      await tick();
      if (ok()) menuNode?.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }
  function closeMenu() {
    menuOpen = false;
  }
  function menuKeydown(event: KeyboardEvent) {
    if (!ok()) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      menuOpen = false;
      root?.querySelector<HTMLButtonElement>("[data-composer-more]")?.focus();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const buttons = [
        ...(menuNode?.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        ) || []),
      ];
      if (!buttons.length) return;
      const at = buttons.findIndex(
        (button) => button === document.activeElement,
      );
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? buttons.length - 1
            : (at +
                (event.key === "ArrowDown" ? 1 : buttons.length - 1) +
                buttons.length) %
              buttons.length;
      buttons[next].focus();
    }
  }
  function keydown(event: KeyboardEvent) {
    if (!ok() || waiting) return;
    if (event.key === "Escape" && dictating) {
      event.preventDefault();
      event.stopPropagation();
      speech.cancel();
      return;
    }
    if (speech.keydown(event)) return;
    if (onkeydown?.(event)) return;
    if (mentionKeydown(event)) return;
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void submit();
    }
  }
  onDestroy(() => {
    active = false;
    speech.dispose();
  });
  onMount(() => {
    const outside = (event: PointerEvent) => {
      if (
        menuOpen &&
        event.target instanceof Node &&
        !menuNode?.contains(event.target) &&
        !root?.querySelector("[data-composer-more]")?.contains(event.target)
      )
        menuOpen = false;
    };
    const voiceEscape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        ok() &&
        !document.querySelector(OPEN_DIALOG)
      )
        speech.cancel();
    };
    const visibility = () => {
      if (document.visibilityState !== "visible") speech.cancel();
    };
    const blur = () => speech.cancel();
    document.addEventListener("keydown", voiceEscape, true);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("blur", blur);
    return () => {
      document.removeEventListener("keydown", voiceEscape, true);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("blur", blur);
    };
  });
  const off = $derived(waiting || disabled);
  // One cell, like WhatsApp (Gimenes #3821): the mic while the box is empty, send once there is
  // something to send, stop while you dictate. On phones and on a computer alike.
  const swap = $derived(filled && !dictating && !refining);
  // While you dictate, the box is a recording bar: a red dot and the time, the text as it comes,
  // a trash on the left that puts the text back as it was before the dictation.
  let dictatedFrom = "",
    elapsed = $state(0);
  $effect(() => {
    if (!dictating) return;
    dictatedFrom = untrack(() => value);
    elapsed = 0;
    const started = Date.now();
    const timer = setInterval(() => {
      elapsed = Math.floor((Date.now() - started) / 1000);
    }, 250);
    return () => clearInterval(timer);
  });
  const clock = $derived(
    `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`,
  );
  function discard() {
    if (!ok()) return;
    const text = dictatedFrom;
    speech.cancel();
    onedit(text);
    void focus(text.length);
  }
  // Icons inside the field: ghost, with a hover one step darker than the field (muted = accent in light).
  const FIELD_ICON =
    "text-muted-foreground hover:bg-secondary-hover hover:text-foreground";
  const SLOT =
    "transition-[opacity,scale,visibility] duration-150 ease-[var(--vb-ease-out-cubic)]";
</script>

<!-- One filled field (#3692): the + on the left, emoji and the mic on the right, the reply and the
     attachments inside it, on top. The mic and send share one cell, so the text never moves sideways:
     send takes the mic's place when there is something to send (#3821). -->
<form
  bind:this={root}
  data-chat-box
  data-composer-field
  data-ready={filled ? "true" : "false"}
  data-swap={swap ? "true" : "false"}
  aria-busy={busy || pending || undefined}
  class="group flex flex-col rounded-3xl bg-muted font-sans text-sm text-foreground transition-shadow duration-150 ease-[var(--vb-ease-out-cubic)] focus-within:shadow-[inset_0_0_0_1px_var(--vb-input)] md:rounded-xl"
  onsubmit={(event) => {
    event.preventDefault();
    void submit();
  }}
>
  {@render above?.()}
  <div class="flex items-end gap-0.5 p-1.5">
    {#if dictating}<IconButton
        label={t("Descartar ditado")}
        size="icon"
        class="text-destructive hover:bg-secondary-hover hover:text-destructive"
        data-composer-discard
        onpointerdown={(event) => {
          if (ok()) event.preventDefault();
        }}
        onclick={discard}><Icon icon="trash-01" size={16} /></IconButton
      >{/if}
    <div class={cn("relative", dictating && "hidden")}>
      <IconButton
        label={t("Mais opções")}
        size="icon"
        class={cn(
          FIELD_ICON,
          "aria-expanded:bg-secondary-hover aria-expanded:text-foreground",
        )}
        bind:ref={more}
        data-composer-more
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        disabled={off || !menu}
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
          if (!ok()) return;
          if (menuOpen) menuOpen = false;
          else void openMenu(event.detail === 0);
        }}><Icon icon="plus" size={16} /></IconButton
      >
      {#if menuOpen && menu}<div
          bind:this={menuNode}
          role="menu"
          tabindex="-1"
          class="absolute bottom-full left-0 z-20 mb-2 grid min-w-56 origin-bottom-left gap-0.5 rounded-xl bg-popover p-1 text-popover-foreground shadow-edge-raised transition-[opacity,scale] duration-150 ease-[var(--vb-ease-out-cubic)] starting:scale-95 starting:opacity-0"
          onkeydown={menuKeydown}
        >
          {@render menu(closeMenu, more)}
        </div>{/if}
    </div>
    {#if label}<label for={id} class="sr-only">{label}</label>{/if}
    {#if dictating}<span
        data-composer-recording
        class="flex h-9 shrink-0 items-center gap-1.5 pl-1.5 text-sm text-muted-foreground tabular-nums"
        ><span class="size-2 animate-pulse rounded-full bg-destructive"
        ></span>{clock}</span
      >{/if}
    <div class="relative flex min-w-0 flex-1">
      {#if mention}<div
          bind:this={mirror}
          aria-hidden="true"
          data-mention-mirror
          class={cn(
            "pointer-events-none absolute inset-0 overflow-hidden break-words whitespace-pre-wrap text-transparent",
            FIELD_TYPE,
          )}
        >
          {#if tinted}{#each segments as segment, index (index)}{#if segment.mention}<mark
                  class="rounded-sm bg-brand-purple/15 text-transparent ring-2 ring-brand-purple/15"
                  >{segment.text}</mark
                >{:else}{segment.text}{/if}{/each}{/if}{"​"}
        </div>{/if}
      <Textarea
        bind:ref={textarea}
        {id}
        rows={lines}
        {maxlength}
        {placeholder}
        {value}
        {...inputProps}
        disabled={off}
        class={cn(
          "relative block max-h-40 min-h-8 min-w-0 flex-1 resize-none rounded-lg bg-transparent break-words shadow-none [field-sizing:content] hover:bg-transparent focus-visible:outline-none md:max-h-64",
          FIELD_TYPE,
        )}
        onscroll={() => {
          if (mirror && textarea) mirror.scrollTop = textarea.scrollTop;
        }}
        oninput={(event) => {
          if (!ok()) return;
          speech.cancel();
          typedAt =
            "inputType" in event && event.inputType === "insertText"
              ? event.currentTarget.selectionStart
              : -1;
          onedit(event.currentTarget.value);
          readCaret();
          oninputtext?.();
        }}
        onselect={readCaret}
        onclick={readCaret}
        onkeyup={(event) => {
          speech.keyup(event);
          readCaret();
        }}
        onkeydown={keydown}
        onblur={() => {
          if (!waiting) speech.cancel();
          onblurfield?.();
        }}
      />
      <!-- Phones: the field is too narrow to share; the chip covered the whole box (Gui #3397). -->
      {#if inside && !value && !off}<div
          class="absolute top-1/2 right-1 hidden -translate-y-1/2 transition-opacity duration-150 starting:opacity-0 md:block"
        >
          {@render inside()}
        </div>{/if}
    </div>
    <IconButton
      label={t("Emoji")}
      size="icon"
      class={cn(FIELD_ICON, dictating && "hidden")}
      disabled={off}
      onclick={() => {
        if (!ok()) return;
        speech.cancel();
        readCaret();
        emoji = true;
      }}><Icon icon="face-smile" size={16} /></IconButton
    >
    <!-- The mic and send share one cell (#3821); while you dictate the mic is the stop button. -->
    <div class="grid *:col-start-1 *:row-start-1">
      {#if speech.supported}<IconButton
          size="icon"
          aria-busy={refining || undefined}
          label={t("Ditar mensagem")}
          title={dictating
            ? t("Parar de ditar")
            : t("Toque pra ditar (ou segure espaço na caixa)")}
          aria-pressed={dictating}
          class={cn(
            SLOT,
            "group-data-[swap=true]:invisible group-data-[swap=true]:scale-75 group-data-[swap=true]:opacity-0",
            dictating
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/85 hover:text-destructive-foreground"
              : FIELD_ICON,
          )}
          disabled={off || busy || refining}
          onpointerdown={(event) => {
            if (ok()) event.preventDefault();
          }}
          onclick={() => {
            if (!ok()) return;
            textarea?.focus();
            if (dictating) speech.stop();
            else void speech.start();
          }}
          >{#if refining}<Spinner size="xs" />{:else}<Icon
              icon={dictating ? "stop-square" : "microphone-01"}
              size={16}
            />{/if}</IconButton
        >{/if}
      <IconButton
        type="submit"
        variant="default"
        size="icon"
        label={t("Enviar")}
        data-composer-send
        aria-busy={pending || undefined}
        class={cn(
          SLOT,
          "rounded-full group-data-[swap=false]:invisible group-data-[swap=false]:scale-75 group-data-[swap=false]:opacity-0",
        )}
        disabled={off || busy || sendDisabled}
        onmousedown={(event) => event.preventDefault()}
        ontouchend={(event) => {
          if (!busy && !sendDisabled && ok()) {
            event.preventDefault();
            void submit();
          }
        }}
        >{#if pending}<Spinner size="xs" />{:else}<Icon
            icon="arrow-up"
            size={16}
          />{/if}</IconButton
      >
    </div>
  </div>
</form>
<EmojiPicker {t} bind:open={emoji} onpick={insert} />
