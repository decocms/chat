<script lang="ts">
  import { onDestroy } from "svelte";
  import type { ChatMessage, ChatActions, ChatBridge } from "../../chatTypes";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import { Copy01, Link01, ReverseLeft } from "../../lib/studio/icons";
  import TooltipProvider from "../../lib/studio/TooltipProvider.svelte";
  import { cn } from "../../lib/studio/utils";
  import { copyChatText } from "./clipboard";
  import { QUICK_REACTIONS } from "./reactions";
  let {
    message,
    roomId,
    actions,
    vb,
    showLink = true,
    floating = false,
    canReact = false,
    me = "",
  }: {
    message: ChatMessage;
    roomId: string;
    actions: ChatActions;
    vb: ChatBridge;
    showLink?: boolean;
    /** The hover toolbar over the message's top-right corner; status lines stay in the flow. */
    floating?: boolean;
    /** Offer the suggested reactions (not on @vibe notices, issues or reminders). */
    canReact?: boolean;
    /** Who is looking, to mark the quick reactions they already gave. */
    me?: string;
  } = $props();
  const mine = (emoji: string) =>
    !!me && (message.reactions?.[emoji] ?? []).includes(me);
  function react(emoji: string) {
    if (!active) return;
    void actions.request({ t: "react", id: message.id, emoji });
  }
  let issue = $state<"empty" | "clipboard" | null>(null),
    copied = $state(false),
    retryLink = $state(false);
  let active = true,
    sequence = 0;
  onDestroy(() => {
    active = false;
    sequence++;
  });
  export async function copy(link = false) {
    if (!active) return;
    retryLink = link;
    const token = ++sequence;
    issue = null;
    copied = false;
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
        copied = true;
        navigator.vibrate?.(15);
      }
    } catch {
      if (active && token === sequence) issue = "clipboard";
    }
  }
</script>

<div
  data-message-actions
  class={floating
    ? "tw:contents"
    : "tw:flex tw:flex-wrap tw:items-center tw:gap-1"}
>
  <div
    data-message-toolbar
    class={cn(
      "tw:flex tw:items-center tw:gap-0.5",
      floating &&
        "tw:pointer-events-none tw:absolute tw:-top-3.5 tw:right-3 tw:z-10 tw:origin-top-right tw:translate-y-0.5 tw:scale-[.98] tw:rounded-full tw:bg-card tw:p-0.5 tw:opacity-0 tw:shadow-[var(--vb-shadow-edge),0_2px_8px_rgb(0_0_0/0.06)] tw:transition-[opacity,translate,scale] tw:duration-150 tw:ease-[cubic-bezier(0.23,1,0.32,1)] tw:group-hover:pointer-events-auto tw:group-hover:translate-y-0 tw:group-hover:scale-100 tw:group-hover:opacity-100 tw:group-has-focus-visible:pointer-events-auto tw:group-has-focus-visible:translate-y-0 tw:group-has-focus-visible:scale-100 tw:group-has-focus-visible:opacity-100 tw:motion-reduce:transition-none tw:pointer-coarse:hidden",
    )}
  >
    <TooltipProvider>
      {#if canReact}{#each QUICK_REACTIONS as emoji (emoji)}<IconButton
            label={vb.t("Reagir com {emoji}", { emoji })}
            data-native-quick-react={emoji}
            aria-pressed={mine(emoji)}
            class={cn(
              "tw:text-base tw:leading-none",
              floating && "tw:rounded-full",
              mine(emoji) && "tw:bg-accent",
            )}
            onclick={() => react(emoji)}>{emoji}</IconButton
          >{/each}
        <div
          aria-hidden="true"
          class="tw:mx-0.5 tw:h-4 tw:w-px tw:shrink-0 tw:bg-border"
        ></div>{/if}
      <IconButton
        label={vb.t("Responder a esta mensagem")}
        data-native-reply={message.id}
        class={floating
          ? "tw:rounded-full tw:text-muted-foreground tw:hover:text-foreground"
          : ""}
        onclick={() => {
          if (active) actions.reply(message.id);
        }}><Icon icon={ReverseLeft} size={16} /></IconButton
      >
      <IconButton
        label={vb.t("Copiar o texto desta mensagem")}
        data-native-copy={message.id}
        class={floating
          ? "tw:rounded-full tw:text-muted-foreground tw:hover:text-foreground"
          : ""}
        onclick={() => {
          void copy();
        }}><Icon icon={Copy01} size={16} /></IconButton
      >
      {#if showLink}<IconButton
          label={vb.t("Copiar o link desta mensagem")}
          data-native-copylink={message.id}
          class={floating
            ? "tw:rounded-full tw:text-muted-foreground tw:hover:text-foreground"
            : ""}
          onclick={() => {
            void copy(true);
          }}><Icon icon={Link01} size={16} /></IconButton
        >{/if}
    </TooltipProvider>
  </div>
  {#if copied || issue}<div
      class={floating
        ? "tw:mt-1 tw:flex tw:flex-wrap tw:items-center tw:justify-end tw:gap-1"
        : "tw:contents"}
    >
      {#if copied}<span
          role="status"
          class="tw:text-xs tw:text-muted-foreground">{vb.t("Copiado")}</span
        >{/if}
      {#if issue}<span role="alert" class="tw:text-xs tw:text-destructive"
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
