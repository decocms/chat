<script lang="ts">
  import { onDestroy } from "svelte";
  import type { z } from "zod";
  import type { MeWait } from "../../../shared/schemas";
  import type { RoomTarget } from "../home/model";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { agentAsks, answerAsk, askApprove, askLine } from "./asks";

  type Wait = z.infer<typeof MeWait>;
  /**
   * "Seu agent precisa de você", a notice of the user center (Gimenes #6602, #6617, #6719): the oldest question one
   * of your agents is waiting on, from any room, in two short lines (the room and the question, cut to one line).
   * A permission (its options have "Aprovar") gets "Aprovar", which answers it right here, and "Detalhes", which
   * opens its message in the thread, where "Negar" is. Any other question gets only "Responder", which opens it.
   * With more questions the title counts them; the next one shows once this one is answered.
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
  const approve = $derived(ask ? askApprove(ask) : undefined);
  let busy = $state(""),
    failed = $state("");
  let active = true;
  onDestroy(() => {
    active = false;
  });
  const title = $derived(
    asks.length > 1
      ? en
        ? `${asks.length} agents need you`
        : `${asks.length} agents precisam de você`
      : en
        ? "Your agent needs you"
        : "Seu agent precisa de você",
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
    class="flex min-w-0 flex-col gap-1.5 rounded-lg px-2.5 py-2 font-sans text-foreground hover:bg-sidebar-accent"
  >
    <div class="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-muted-foreground"
        ><Icon icon="clock" size={16} /></span
      ><span class="grid min-w-0 flex-1"
        ><span class="truncate text-sm font-medium">{title}</span><span
          class="truncate text-xs text-muted-foreground"
          title={askLine(ask)}>{ask.room} · {askLine(ask)}</span
        ></span
      >
    </div>
    <div class="flex flex-wrap gap-1 pl-9.5">
      {#if approve}<Button
          size="xs"
          disabled={!!busy}
          aria-busy={!!busy || undefined}
          onclick={(event) => {
            if (event.currentTarget.isConnected) void answer(approve);
          }}>{en ? "Approve" : "Aprovar"}</Button
        >{/if}<Button
        size="xs"
        variant="ghost"
        onclick={(event) => {
          if (event.currentTarget.isConnected) open();
        }}
        >{approve
          ? en
            ? "Details"
            : "Detalhes"
          : en
            ? "Answer"
            : "Responder"}</Button
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
