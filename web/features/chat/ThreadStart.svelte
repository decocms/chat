<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type {
    ChatActions,
    ChatBridge,
    ChatMessage,
  } from "../../app/chatTypes";
  import InlineAdd from "../../lib/components/InlineAdd.svelte";
  import { threadTitle, newThreadId } from "./model";
  /**
   * "Criar thread" on a message (Gimenes #4123): one title line under the message, filled with the start of its
   * text. Enter creates the thread from this message and opens it. The server makes the thread start from the main
   * thread: from this message when it is in main, else from a new line in main that links it.
   */
  let {
    message,
    actions,
    vb,
    onclose,
  }: {
    message: ChatMessage;
    actions: ChatActions;
    vb: ChatBridge;
    onclose: () => void;
  } = $props();
  // The title starts from the message once; edits are the person's own.
  let title = $state(untrack(() => threadTitle(message.text ?? ""))),
    busy = $state(false),
    error = $state(""),
    input = $state<HTMLInputElement | null>(null);
  // One id for this form: a retry of the same create (a lost answer) does not make a second thread.
  const id = newThreadId();
  onMount(() => {
    input?.focus();
    input?.select();
  });
  async function create(event: SubmitEvent) {
    event.preventDefault();
    const text = title.trim();
    if (!text || busy) return;
    busy = true;
    error = "";
    const outcome = await actions.request({
      t: "epic",
      title: text,
      from: message.id,
      id,
    });
    busy = false;
    if (!outcome.ok) {
      error = vb.t("Não deu pra criar a thread.");
      return;
    }
    onclose();
    actions.openThread?.(id);
  }
</script>

<form data-thread-start={message.id} class="mt-1 max-w-md" onsubmit={create}>
  <InlineAdd
    bind:ref={input}
    bind:value={title}
    aria-label={vb.t("Título da thread")}
    placeholder={vb.t("Título da thread")}
    enterkeyhint="done"
    maxlength={200}
    confirmDisabled={busy || !title.trim()}
    confirmLabel={vb.t("Criar thread")}
    cancelLabel={vb.t("Cancelar")}
    oncancel={onclose}
  />
  {#if error}<p role="alert" class="m-0 mt-1 text-xs text-destructive">
      {error}
    </p>{/if}
</form>
