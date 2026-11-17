<script lang="ts">
  import { onDestroy } from "svelte";
  import type { ChatMessage, ChatActions, ChatBridge } from "../../chatTypes";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import {
    Copy01,
    FaceSmile,
    Link01,
    ReverseLeft,
  } from "../../lib/studio/icons";
  import Popover from "../../lib/studio/Popover.svelte";
  import PopoverContent from "../../lib/studio/PopoverContent.svelte";
  import PopoverTrigger from "../../lib/studio/PopoverTrigger.svelte";
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
  }: {
    message: ChatMessage;
    roomId: string;
    actions: ChatActions;
    vb: ChatBridge;
    showLink?: boolean;
    /** The hover toolbar over the message's top-right corner; status lines stay in the flow. */
    floating?: boolean;
    /** Offer the 😊 quick reactions (not on @vibe notices, issues or reminders). */
    canReact?: boolean;
  } = $props();
  let reacting = $state(false);
  function react(emoji: string) {
    reacting = false;
    if (active) void actions.request({ t: "react", id: message.id, emoji });
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
      floating &&
        reacting &&
        "tw:pointer-events-auto tw:translate-y-0 tw:scale-100 tw:opacity-100",
    )}
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
    {#if canReact}<Popover bind:open={reacting}>
        <PopoverTrigger>
          {#snippet child({ props })}
            <IconButton
              {...props}
              label={vb.t("Reagir a esta mensagem")}
              data-native-react={message.id}
              class={floating
                ? "tw:rounded-full tw:text-muted-foreground tw:hover:text-foreground"
                : ""}><Icon icon={FaceSmile} size={16} /></IconButton
            >
          {/snippet}
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={6}
          data-vb-native
          class="tw:flex tw:w-auto tw:gap-0.5 tw:rounded-full tw:p-1 tw:font-sans"
        >
          {#each QUICK_REACTIONS as emoji}<button
              type="button"
              aria-label={emoji}
              class="tw:flex tw:size-9 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-full tw:text-xl tw:leading-none tw:transition-transform tw:duration-150 tw:ease-out tw:hover:scale-110 tw:hover:bg-accent tw:focus-visible:outline-2 tw:focus-visible:outline-ring tw:motion-reduce:transition-none"
              onclick={() => react(emoji)}>{emoji}</button
            >{/each}
        </PopoverContent>
      </Popover>{/if}
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
