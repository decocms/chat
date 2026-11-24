<script lang="ts">
  import { onDestroy } from "svelte";
  import type {
    ChatMessage,
    ChatActions,
    ChatBridge,
  } from "../../app/chatTypes";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import TooltipProvider from "../../lib/studio/TooltipProvider.svelte";
  import { cn } from "../../lib/studio/utils";
  import { copyChatText } from "./clipboard";
  import EmojiPicker from "../composer/EmojiPicker.svelte";
  import { QUICK_REACTIONS, TOOLBAR_REACTIONS } from "./reactions";
  let {
    message,
    roomId,
    actions,
    vb,
    showLink = true,
    floating = false,
    canReact = false,
    me = "",
    onthread,
  }: {
    message: ChatMessage;
    roomId: string;
    actions: ChatActions;
    vb: ChatBridge;
    showLink?: boolean;
    /** The hover toolbar: on the name row of a message that has one (the row is short), else just above the message,
     * over the one before it, never over the text you point at; status lines stay in the flow. */
    floating?: boolean;
    /** Offer the suggested reactions (not on @vibe notices, issues or reminders). */
    canReact?: boolean;
    /** Who is looking, to mark the quick reactions they already gave. */
    me?: string;
    /** "Criar thread" (Gimenes #4310): makes the thread from this message and opens it. None: the message cannot
     *  start one. */
    onthread?: () => void;
  } = $props();
  const mine = (emoji: string) =>
    !!me && (message.reactions?.[emoji] ?? []).includes(me);
  // The full emoji picker, past the four quick ones (like Discord's and Slack's "add reaction").
  let picking = $state(false);
  function react(emoji: string) {
    if (!active) return;
    void actions.request({ t: "react", id: message.id, emoji });
  }
  let issue = $state<"empty" | "clipboard" | null>(null),
    copied = $state<"text" | "link" | null>(null),
    retryLink = $state(false);
  let active = true,
    sequence = 0,
    reset: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => {
    active = false;
    sequence++;
    clearTimeout(reset);
  });
  export async function copy(link = false) {
    if (!active) return;
    retryLink = link;
    const token = ++sequence;
    issue = null;
    copied = null;
    clearTimeout(reset);
    const text = link
      ? `${location.origin}/b/${roomId}${message.thread && message.thread !== "main" ? `?t=${encodeURIComponent(message.thread)}` : ""}#m${message.id}`
      : message.text || message.files?.map((f) => f.name).join("\n") || "";
    if (!text) {
      issue = "empty";
      return;
    }
    try {
      await copyChatText(text);
      if (active && token === sequence) {
        // The button itself says it: its icon turns into ✓ and its tooltip reads "Copied", for a moment.
        copied = link ? "link" : "text";
        navigator.vibrate?.(15);
        reset = setTimeout(() => {
          if (active && token === sequence) copied = null;
        }, 1500);
      }
    } catch {
      if (active && token === sequence) issue = "clipboard";
    }
  }
</script>

<div
  data-message-actions
  data-chat-hover-only={floating ? "" : undefined}
  class={floating ? "contents" : "flex flex-wrap items-center gap-1"}
>
  <div
    data-message-toolbar
    class={cn(
      "flex items-center gap-0.5",
      floating &&
        "pointer-events-none absolute -top-2.5 right-3 z-10 in-data-continuous:-top-7.5 origin-top-right translate-y-0.5 scale-[.98] rounded-full bg-card p-0.5 opacity-0 shadow-[var(--vb-shadow-edge),0_2px_8px_rgb(0_0_0/0.06)] transition-[opacity,translate,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-has-focus-visible:pointer-events-auto group-has-focus-visible:translate-y-0 group-has-focus-visible:scale-100 group-has-focus-visible:opacity-100 motion-reduce:transition-none pointer-coarse:hidden",
    )}
  >
    <TooltipProvider>
      {#if canReact}{#each floating ? TOOLBAR_REACTIONS : QUICK_REACTIONS as emoji (emoji)}<IconButton
            label={vb.t("Reagir com {emoji}", { emoji })}
            data-quick-react={emoji}
            aria-pressed={mine(emoji)}
            class={cn(
              "text-base leading-none",
              floating && "rounded-full",
              mine(emoji) && "bg-accent",
            )}
            onclick={() => react(emoji)}>{emoji}</IconButton
          >{/each}
        {#if floating}<IconButton
            label={vb.t("Mais reações")}
            data-more-reactions={message.id}
            class="rounded-full text-muted-foreground hover:text-foreground"
            onclick={() => (picking = true)}
            ><Icon icon="face-smile" size={16} /></IconButton
          >{/if}
        <div
          aria-hidden="true"
          class="mx-0.5 h-4 w-px shrink-0 bg-border"
        ></div>{/if}
      <IconButton
        label={vb.t("Responder a esta mensagem")}
        data-reply={message.id}
        class={floating
          ? "rounded-full text-muted-foreground hover:text-foreground"
          : ""}
        onclick={() => {
          if (active) actions.reply(message.id);
        }}><Icon icon="reverse-left" size={16} /></IconButton
      >
      {#if onthread}<IconButton
          label={vb.t("Criar thread")}
          data-start-thread={message.id}
          class={floating
            ? "rounded-full text-muted-foreground hover:text-foreground"
            : ""}
          onclick={() => {
            if (active) onthread?.();
          }}><Icon icon="git-branch-01" size={16} /></IconButton
        >{/if}
      <IconButton
        label={copied === "text"
          ? vb.t("Copiado")
          : vb.t("Copiar o texto desta mensagem")}
        data-copy={message.id}
        class={floating
          ? "rounded-full text-muted-foreground hover:text-foreground"
          : ""}
        onclick={() => {
          void copy();
        }}
        ><Icon
          icon={copied === "text" ? "check" : "copy-01"}
          size={16}
        /></IconButton
      >
      {#if showLink}<IconButton
          label={copied === "link"
            ? vb.t("Copiado")
            : vb.t("Copiar o link desta mensagem")}
          data-copylink={message.id}
          class={floating
            ? "rounded-full text-muted-foreground hover:text-foreground"
            : ""}
          onclick={() => {
            void copy(true);
          }}
          ><Icon
            icon={copied === "link" ? "check" : "link-01"}
            size={16}
          /></IconButton
        >{/if}
    </TooltipProvider>
  </div>
  <!-- Floating toolbar: the button shows it (✓ + tooltip), this is for screen readers. Inline (phones): a word. -->
  {#if copied}<span
      role="status"
      class={floating ? "sr-only" : "text-xs text-muted-foreground"}
      >{vb.t("Copiado")}</span
    >{/if}
  {#if issue}<div
      class={floating
        ? "mt-1 flex flex-wrap items-center justify-end gap-1"
        : "contents"}
    >
      {#if issue}<span role="alert" class="text-xs text-destructive"
          >{vb.t(
            issue === "empty"
              ? "Essa mensagem não tem texto pra copiar."
              : "O navegador pediu um toque pra copiar.",
          )}</span
        >{#if issue === "clipboard"}<Button
            variant="outline"
            size="sm"
            onclick={() => {
              void copy(retryLink);
            }}>{vb.t("Copiar")}</Button
          >{/if}{/if}
    </div>{/if}
</div>
{#if floating && canReact}<EmojiPicker
    t={vb.t}
    bind:open={picking}
    onpick={(emoji) => react(emoji)}
  />{/if}
