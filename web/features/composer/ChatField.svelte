<script lang="ts">
  import type { Snippet } from "svelte";
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import { COMPOSER_BOX, COMPOSER_ROW } from "./shape";
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
  import {
    markdownPaste,
    markdownShortcut,
    shortcutHints,
  } from "./markdownShortcuts";
  import { insertAt, mentionKey, mentionSegments } from "./model";
  import EmojiPicker from "./EmojiPicker.svelte";
  import RoomMark from "../room-sidebar/RoomMark.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import {
    fieldView,
    fromView,
    snapSelection,
    storedSlice,
    toStored,
    toView,
    tokenKey,
    type FieldLink,
    type FieldToken,
  } from "./fieldTokens";

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
    dock = false,
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
    links,
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
    /** Items of the + menu (styled like the design system's dropdown menu: same box, row radius and padding); `close` closes it, `trigger` is the + button (stays in the page,
     *  so a dialog opened from the menu can return focus to it). Without it the + is disabled. */
    menu?: Snippet<[close: () => void, trigger: HTMLElement | null]>;
    /** Shown at the right end of the field while it's empty. */
    inside?: Snippet;
    /** Shown inside the field, above the text: the reply strip and the attachments of the room's composer. */
    above?: Snippet;
    /** There is something to send: the send button shows (on phones it takes the mic's place). Defaults to text in the field. */
    ready?: boolean;
    /** The phone home's docked ask (HomePanel): 40px controls with 22px glyphs, a 48px row, and no empty mic
     *  slot when this browser cannot dictate. */
    dock?: boolean;
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
    /** The room and thread links in the text that the field shows as their chip (the text keeps the link). Each one
     *  is a single unit: one Backspace deletes it, the caret can't go inside it, copy keeps the link. */
    links?: (text: string) => FieldLink[];
  } = $props();

  let active = true,
    root = $state<HTMLFormElement | null>(null),
    menuNode = $state<HTMLElement | null>(null),
    more = $state<HTMLElement | null>(null),
    emoji = $state(false),
    seen = untrack(() => value),
    counted = 0,
    mirror = $state<HTMLElement | null>(null),
    // The field has the focus: the shortcut hints show only while you select text in it.
    focused = $state(false),
    // Where the last typed character went: Backspace right there edits a hand-typed mention letter by letter.
    typedAt = -1;
  // What the textarea holds: the text with each room/thread link as a token the mirror draws as its chip.
  const viewOf = (text: string) => fieldView(text, links ? links(text) : []);
  const view = $derived(viewOf(value));
  // Every chip the field has shown, by its text: undo puts a deleted chip's text back, and it is that link again.
  const known = new Map<string, string>();
  $effect(() => {
    for (const token of view.tokens)
      if (!known.has(token.text)) known.set(token.text, token.url);
  });
  // A link's answer can come while you type elsewhere in the field: the text under the caret changes (the link turns
  // into its chip), so the caret goes back where it was in the stored text instead of jumping to the end.
  let shownValue = untrack(() => value),
    shownView = untrack(() => view.text);
  $effect(() => {
    const next = view;
    untrack(() => {
      const swapped = value === shownValue && next.text !== shownView;
      shownValue = value;
      shownView = next.text;
      if (
        !swapped ||
        !textarea ||
        textarea.value !== next.text ||
        document.activeElement !== textarea
      )
        return;
      textarea.setSelectionRange(
        toView(next, caret),
        toView(next, selectionEnd),
        textarea.selectionDirection,
      );
    });
  });
  type Part =
    | { kind: "text"; text: string }
    | { kind: "mention"; text: string }
    | { kind: "chip"; text: string; token: FieldToken };
  const parts = $derived.by(() => {
    const out: Part[] = [];
    const plain = (text: string) => {
      if (!text) return;
      if (!mention) {
        out.push({ kind: "text", text });
        return;
      }
      for (const segment of mentionSegments(text, mention))
        out.push({
          kind: segment.mention ? "mention" : "text",
          text: segment.text,
        });
    };
    let at = 0;
    for (const token of view.tokens) {
      plain(view.text.slice(at, token.from));
      out.push({ kind: "chip", text: token.text, token });
      at = token.to;
    }
    plain(view.text.slice(at));
    return out;
  });
  // Mentions and chips are drawn by the mirror, in color: the textarea's own text turns transparent (the caret stays).
  const styled = $derived(parts.some((part) => part.kind !== "text"));
  // The highlight layer and the textarea share these classes (type, padding), so the mirror's
  // text wraps exactly where the field's does.
  // The formatting shortcuts, shown while you select text: nobody found them with no hint (#484).
  const HINTS = shortcutHints();
  const FIELD_TYPE =
    "px-1.5 py-1.5 text-[15px] pointer-coarse:text-[16px] leading-5 max-md:text-[17px] max-md:pointer-coarse:text-[17px] max-md:leading-6 [scrollbar-gutter:stable]";
  function mentionKeydown(event: KeyboardEvent) {
    if (
      (!mention && !view.tokens.length) ||
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
      step =
        tokenKey(view, at, event.key) ??
        (mention
          ? mentionKey(view.text, at, event.key, mention, typedAt === at)
          : null);
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
      start: textarea ? toStored(view, textarea.selectionStart) : value.length,
      end: textarea ? toStored(view, textarea.selectionEnd) : value.length,
    }),
    write: (text, at) => {
      if (!ok()) return;
      onedit(text);
      if (textarea) {
        const next = viewOf(text);
        textarea.value = next.text;
        if (at !== undefined) {
          const shown = toView(next, at);
          textarea.setSelectionRange(shown, shown);
        }
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
    if (at !== undefined) {
      const shown = toView(view, at);
      textarea.setSelectionRange(shown, shown);
    }
    readCaret();
  }
  /** Reads the caret back (in the stored text), first moving it out of any chip. `back` = it moved left. */
  function readCaret(back = false) {
    if (!textarea) return;
    if (view.tokens.length) {
      const { selectionStart, selectionEnd: end } = textarea,
        [from, to] = snapSelection(view, selectionStart, end, back);
      if (from !== selectionStart || to !== end)
        textarea.setSelectionRange(from, to, textarea.selectionDirection);
    }
    caret = toStored(view, textarea.selectionStart);
    selectionEnd = toStored(view, textarea.selectionEnd);
  }
  /** Copy and cut keep the links the chips stand for. */
  function clip(event: ClipboardEvent, cut: boolean) {
    if (!textarea || !event.clipboardData || !view.tokens.length) return;
    const { selectionStart: start, selectionEnd: end } = textarea;
    if (start === end || !view.tokens.some((t) => t.from < end && t.to > start))
      return;
    event.preventDefault();
    event.clipboardData.setData(
      "text/plain",
      storedSlice(view, value, start, end),
    );
    if (!cut || !ok()) return;
    const from = toStored(view, start);
    onedit(value.slice(0, from) + value.slice(toStored(view, end)));
    void focus(from);
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
    if (markdownShortcut(event)) return;
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
  // Phones: one cell, like WhatsApp (Gimenes #3821): the mic while the box is empty, send once there is
  // something to send, stop while you dictate. A computer has room for both: the mic stays next to send,
  // so you can dictate into text that is already there (Daniel, 2026-11-25).
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
  const GLYPH = $derived(dock ? 22 : 16);
  const CONTROL = $derived(dock ? "size-10" : "");
</script>

<!-- One filled field (#3692): the + on the left, emoji and the mic on the right, the reply and the
     attachments inside it, on top. On phones the mic and send share one cell, so the text never moves
     sideways: send takes the mic's place when there is something to send (#3821). On a computer both
     show; send is off until there is something to send. -->
<form
  bind:this={root}
  data-chat-box
  data-composer-field
  data-ready={filled ? "true" : "false"}
  data-swap={swap ? "true" : "false"}
  aria-busy={busy || pending || undefined}
  class={[
    COMPOSER_BOX,
    "group flex flex-col font-sans text-sm text-foreground transition-shadow duration-150 ease-[var(--vb-ease-out-cubic)] focus-within:shadow-[inset_0_0_0_1px_var(--vb-input)]",
  ]}
  onsubmit={(event) => {
    event.preventDefault();
    void submit();
  }}
>
  {@render above?.()}
  <div
    class={[
      "flex items-end gap-0.5",
      dock ? "min-h-12 px-1 py-1" : COMPOSER_ROW,
    ]}
  >
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
          CONTROL,
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
        }}><Icon icon="plus" size={GLYPH} /></IconButton
      >
      {#if menuOpen && menu}<div
          bind:this={menuNode}
          role="menu"
          tabindex="-1"
          class="absolute bottom-full left-0 z-20 mb-2 grid min-w-56 origin-bottom-left rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md transition-[opacity,scale] duration-150 ease-[var(--vb-ease-out-cubic)] starting:scale-95 starting:opacity-0 [&>[role=menuitem]]:h-auto [&>[role=menuitem]]:rounded-lg [&>[role=menuitem]]:px-2 [&>[role=menuitem]]:py-1.5 [&>[role=menuitem]]:font-normal [&>[role=menuitem]]:active:translate-y-0 [&>[role=menuitem]_small]:text-muted-foreground [&>[role=menuitem]_svg]:text-muted-foreground"
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
      <!-- Desktop with a mouse only: a phone has no ⌘ or Ctrl keys. -->
      {#if focused && caret !== selectionEnd && !off}<div
          data-format-hints
          class="pointer-events-none absolute bottom-full left-0 z-10 mb-2 hidden items-center gap-3 rounded-lg border border-border bg-popover px-2 py-1 text-xs whitespace-nowrap text-muted-foreground shadow-sm transition-opacity duration-150 starting:opacity-0 md:pointer-fine:flex"
        >
          {#each HINTS as hint (hint.keys)}<span
              ><span class="font-medium text-foreground">{hint.keys}</span>
              {t(hint.label)}</span
            >{/each}
        </div>{/if}
      {#if mention || links}<div
          bind:this={mirror}
          aria-hidden="true"
          data-mention-mirror
          class={cn(
            "pointer-events-none absolute inset-0 overflow-hidden break-words whitespace-pre-wrap",
            styled ? "text-foreground" : "text-transparent",
            FIELD_TYPE,
          )}
        >
          <!-- Same type as the field, so each glyph sits under the textarea's own (transparent) one: the
               mention is the chat's purple text and the link is its chip, drawn over its token's width. -->
          {#if styled}{#each parts as part, index (index)}{#if part.kind === "mention"}<mark
                  data-field-mention
                  class="rounded-sm bg-brand-purple/15 text-brand-purple-text ring-2 ring-brand-purple/15 [-webkit-text-stroke:0.3px_currentColor]"
                  >{part.text}</mark
                >{:else if part.kind === "chip"}<span
                  data-field-chip={part.token.kind}
                  data-field-link={part.token.url}
                  class={cn(
                    "relative rounded-md ring-3",
                    part.token.kind === "private"
                      ? "bg-secondary text-muted-foreground ring-secondary"
                      : "bg-brand-purple/15 text-brand-purple-text ring-brand-purple/15",
                  )}
                  ><span
                    class="absolute top-1/2 left-0.5 flex size-4 -translate-y-1/2 items-center justify-center"
                    >{#if part.token.mark.kind === "room"}<RoomMark
                        title={part.token.mark.title}
                        src={part.token.mark.icon
                          ? `/api/books/${encodeURIComponent(part.token.mark.id)}/icon?v=${part.token.mark.icon}`
                          : undefined}
                        size="2xs"
                      />{:else if part.token.mark.kind === "person"}<PersonAvatar
                        email={part.token.mark.email}
                        version={part.token.mark.avatar}
                        size="2xs"
                      />{:else if part.token.mark.kind === "lock"}<Icon
                        icon="lock-01"
                        size={14}
                      />{:else}<Icon
                        icon="message-circle-01"
                        size={16}
                        class="text-brand-purple-text/70"
                      />{/if}</span
                  >{part.text}</span
                >{:else}{part.text}{/if}{/each}{/if}{"​"}
        </div>{/if}
      <Textarea
        bind:ref={textarea}
        {id}
        rows={lines}
        {maxlength}
        {placeholder}
        value={view.text}
        {...inputProps}
        disabled={off}
        class={cn(
          "relative block max-h-40 min-h-8 min-w-0 flex-1 resize-none rounded-lg bg-transparent break-words shadow-none [field-sizing:content] hover:bg-transparent focus-visible:outline-none md:max-h-64",
          styled && "text-transparent caret-foreground transition-none",
          FIELD_TYPE,
        )}
        onscroll={() => {
          if (mirror && textarea) mirror.scrollTop = textarea.scrollTop;
        }}
        oninput={(event) => {
          if (!ok()) return;
          speech.cancel();
          const node = event.currentTarget,
            back = fromView(view, node.value, known),
            at = back.at(node.selectionStart);
          typedAt =
            "inputType" in event && event.inputType === "insertText"
              ? node.selectionStart
              : -1;
          onedit(back.text);
          // A pasted link to a room turns into its chip: the field's text changes under the caret.
          const next = viewOf(back.text);
          if (next.text !== node.value) {
            node.value = next.text;
            const shown = toView(next, at);
            node.setSelectionRange(shown, shown);
            typedAt = -1;
          }
          caret = toStored(next, node.selectionStart);
          selectionEnd = toStored(next, node.selectionEnd);
          oninputtext?.();
        }}
        oncopy={(event) => clip(event, false)}
        oncut={(event) => clip(event, true)}
        onselect={() => readCaret()}
        onclick={() => readCaret()}
        onkeyup={(event) => {
          speech.keyup(event);
          readCaret(event.key === "ArrowLeft" || event.key === "ArrowUp");
        }}
        onkeydown={keydown}
        onpaste={(event) => {
          if (ok()) markdownPaste(event);
        }}
        onfocus={() => (focused = true)}
        onblur={() => {
          focused = false;
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
    <EmojiPicker
      {t}
      bind:open={emoji}
      onpick={insert}
      keepFocusOnPick
      side="top"
      align="end"
      onbeforeopen={() => {
        if (!ok()) return false;
        speech.cancel();
        readCaret();
      }}
    >
      {#snippet trigger(props)}<IconButton
          {...props}
          label={t("Emoji")}
          size="icon"
          data-composer-emoji
          class={cn(
            FIELD_ICON,
            CONTROL,
            "data-[state=open]:bg-accent data-[state=open]:text-foreground",
            dictating && "hidden",
          )}
          disabled={off}><Icon icon="face-smile" size={GLYPH} /></IconButton
        >{/snippet}
    </EmojiPicker>
    <!-- Phones: the mic and send share one cell (#3821). While you dictate the mic is the stop button. -->
    <div
      class="flex items-end gap-0.5 max-md:grid max-md:gap-0 max-md:*:col-start-1 max-md:*:row-start-1"
    >
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
            CONTROL,
            "max-md:group-data-[swap=true]:invisible max-md:group-data-[swap=true]:scale-75 max-md:group-data-[swap=true]:opacity-0",
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
              size={GLYPH}
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
          CONTROL,
          "rounded-full max-md:group-data-[swap=false]:invisible max-md:group-data-[swap=false]:scale-75 max-md:group-data-[swap=false]:opacity-0",
          // No mic to share the cell with: an empty field has no send either, and no gap where it was.
          dock && !speech.supported && "max-md:group-data-[swap=false]:hidden",
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
            size={GLYPH}
          />{/if}</IconButton
      >
    </div>
  </div>
</form>
