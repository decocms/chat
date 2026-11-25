<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import type {
    ChatActions,
    ChatBridge,
    ChatMessage,
  } from "../../app/chatTypes";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import EmojiPicker from "../composer/EmojiPicker.svelte";
  import { stopEditing } from "./editing";
  let {
    message,
    actions,
    vb,
  }: {
    message: ChatMessage;
    actions: ChatActions;
    vb: ChatBridge;
  } = $props();
  // Your message, edited in place like Discord: the text becomes a box as wide as the text was, Enter saves (Shift+Enter
  // is a new line), Esc cancels. The same "msg.edit" the edit dialog sent.
  let text = $state(untrack(() => message.text)),
    busy = $state(false),
    error = $state(""),
    picking = $state(false),
    box = $state<HTMLTextAreaElement | null>(null);
  let active = true;
  onMount(() => {
    if (!box) return;
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  });
  onDestroy(() => {
    active = false;
  });
  function cancel() {
    stopEditing(message.id);
  }
  async function save() {
    if (busy) return;
    // An empty text does not delete the message: that is the delete button, which asks first.
    if (!text.trim()) return;
    if (text === message.text) {
      cancel();
      return;
    }
    busy = true;
    error = "";
    const outcome = await actions.request({
      t: "msg.edit",
      id: message.id,
      text,
    });
    if (!active) return;
    busy = false;
    if (!outcome.ok) error = outcome.error;
    else cancel();
  }
  function keydown(event: KeyboardEvent) {
    if (event.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void save();
    }
  }
  async function insert(emoji: string) {
    if (!active || !box) return;
    const start = box.selectionStart,
      end = box.selectionEnd;
    text = text.slice(0, start) + emoji + text.slice(end);
    await tick();
    if (!active || !box) return;
    box.focus();
    box.setSelectionRange(start + emoji.length, start + emoji.length);
  }
</script>

<div data-message-editor={message.id} class="space-y-1 pt-0.5">
  <div
    class="flex items-end gap-1 rounded-xl bg-muted py-1 pr-1 pl-3 transition-shadow duration-150 ease-[var(--vb-ease-out-cubic)] focus-within:shadow-[inset_0_0_0_1px_var(--vb-input)]"
  >
    <textarea
      bind:this={box}
      bind:value={text}
      rows={1}
      aria-label={vb.t("Texto da mensagem")}
      aria-busy={busy || undefined}
      readonly={busy}
      class="my-1 block max-h-64 min-h-6 min-w-0 flex-1 resize-none border-0 bg-transparent p-0 font-sans text-[0.875rem] leading-6 break-words text-foreground outline-none [field-sizing:content] pointer-coarse:text-[16px] focus-visible:outline-none"
      onkeydown={keydown}></textarea>
    <IconButton
      label={vb.t("Emoji")}
      data-message-editor-emoji
      class="shrink-0 text-muted-foreground hover:bg-secondary-hover hover:text-foreground"
      onclick={() => (picking = true)}
      ><Icon icon="face-smile" size={16} /></IconButton
    >
  </div>
  {#if error}<p role="alert" class="m-0 text-xs text-destructive">
      {error}
    </p>{/if}
  <p
    data-message-editor-hint
    class="m-0 text-xs text-muted-foreground select-none"
  >
    {vb.t("esc para")}
    <button
      type="button"
      data-message-editor-cancel
      class="cursor-pointer border-0 bg-transparent p-0 font-sans text-xs text-link hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      onclick={cancel}>{vb.t("cancelar")}</button
    >
    •
    {vb.t("enter para")}
    <button
      type="button"
      data-message-editor-save
      disabled={busy}
      class="cursor-pointer border-0 bg-transparent p-0 font-sans text-xs text-link hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default"
      onclick={() => void save()}>{vb.t("salvar")}</button
    >
  </p>
</div>
<EmojiPicker
  t={vb.t}
  bind:open={picking}
  onpick={(emoji) => void insert(emoji)}
/>
