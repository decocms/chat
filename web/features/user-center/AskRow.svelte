<script lang="ts">
  import { onDestroy } from "svelte";
  import type { z } from "zod";
  import type { MeWait } from "../../../shared/schemas";
  import type { RoomTarget } from "../home/model";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { agentAsks, answerAsk, askLine, askOptions } from "./asks";

  type Wait = z.infer<typeof MeWait>;
  /**
   * "Seu agent espera você", a notice of the user center (Gimenes #6602, #6617): the oldest question one of your
   * agents is waiting on, from any room, with its options as buttons that answer it right here. The room and thread
   * it is in, and "Ver", open it. With more questions the title counts them; the next one shows once this one is
   * answered. It was a card over the chat, only in that room (AgentBanners).
   */
  let {
    waits,
    lang,
    onopen,
    onanswered,
  }: {
    waits: readonly Wait[] | undefined;
    lang: "pt" | "en";
    onopen: (target: RoomTarget) => void;
    /** After an answer the room took: read /api/me again, so the wait goes. */
    onanswered: () => void;
  } = $props();
  const en = $derived(lang === "en");
  const asks = $derived(agentAsks(waits));
  const ask = $derived(asks[0]);
  const options = $derived(ask ? askOptions(ask) : []);
  let busy = $state(""),
    failed = $state("");
  let active = true;
  onDestroy(() => {
    active = false;
  });
  const title = $derived(
    asks.length > 1
      ? en
        ? `${asks.length} agents are waiting for you`
        : `${asks.length} agents esperam você`
      : en
        ? "Your agent is waiting for you"
        : "Seu agent espera você",
  );
  function open() {
    if (!ask) return;
    const id = Number(ask.ref.slice(1));
    onopen({
      roomId: ask.book_id,
      thread: ask.thread || "main",
      messageId: Number.isSafeInteger(id) ? id : undefined,
    });
  }
  async function answer(value: string) {
    const current = ask;
    if (!current || busy) return;
    busy = value;
    failed = "";
    const ok = await answerAsk(current, value);
    if (!active) return;
    busy = "";
    if (ok) onanswered();
    else failed = current.ref;
  }
</script>

{#if ask}<div
    data-agent-ask={ask.ref}
    role="region"
    aria-label={title}
    class="flex min-w-0 flex-col gap-2 rounded-lg px-2.5 py-2 font-sans text-foreground hover:bg-sidebar-accent"
  >
    <div class="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-muted-foreground"
        ><Icon icon="clock" size={16} /></span
      ><button
        type="button"
        class="grid min-w-0 flex-1 cursor-pointer text-left"
        onclick={(event) => {
          if (event.currentTarget.isConnected) open();
        }}
        ><span class="truncate text-sm font-medium">{title}</span><span
          class="truncate text-xs text-muted-foreground"
          title={askLine(ask)}
          >{ask.room}{ask.topic ? ` · ${ask.topic}` : ""}</span
        ></button
      >
    </div>
    <p class="m-0 line-clamp-3 pl-9.5 text-xs break-words text-foreground">
      {askLine(ask)}
    </p>
    <div class="flex flex-wrap gap-1 pl-9.5">
      {#each options as option (option)}<Button
          size="xs"
          variant="outline"
          class="h-auto min-h-6 whitespace-normal text-left"
          disabled={!!busy}
          aria-busy={busy === option || undefined}
          onclick={(event) => {
            if (event.currentTarget.isConnected) void answer(option);
          }}>{option}</Button
        >{/each}<Button
        size="xs"
        variant="ghost"
        onclick={(event) => {
          if (event.currentTarget.isConnected) open();
        }}>{en ? "View" : "Ver"}</Button
      >
    </div>
    {#if failed === ask.ref}<p
        role="alert"
        class="m-0 pl-9.5 text-xs text-destructive"
      >
        {en
          ? "Could not send. Try again."
          : "Não deu pra enviar. Tente de novo."}
      </p>{/if}
  </div>{/if}
