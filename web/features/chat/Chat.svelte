<script lang="ts">
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { CALL_THREAD } from "../../../shared/call";
  import { onMount } from "svelte";
  import Message from "./Message.svelte";
  import CallLine from "./CallLine.svelte";
  import type { ChatProps } from "../../app/chatTypes";
  import {
    foldMessages,
    newDay,
    dayLabel,
    messageFooters,
    threadWorkers,
    prettyModel,
    messageAuthor,
  } from "./model";
  import { selectedMessages, transcriptText } from "./clipboard";
  import Button from "../../lib/studio/Button.svelte";
  import {
    AGENT_TILES,
    agentMark,
    agentProvider,
  } from "../../lib/components/agent";
  import { productionStatuses } from "./production";
  import { startedThread, THREAD_UNDO_MS } from "./threadUndo";
  import Icon from "../../lib/studio/Icon.svelte";
  import ForwardPicker from "../forward/ForwardPicker.svelte";
  import { forwardable } from "../forward/model";
  import {
    clickForward,
    forwardPicking,
    forwardSelection,
    stopForward,
  } from "../forward/selection";
  let {
    room,
    thread,
    list,
    previous,
    more = false,
    origin = null,
    replyCount = 0,
    vb,
    actions,
    onloadolder,
  }: ChatProps = $props();
  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => {
      now = Date.now();
    }, 30_000);
    return () => clearInterval(timer);
  });
  const rows = $derived(foldMessages(list));
  // "Encaminhar" (forward): selection mode of this thread, the messages it can pick (oldest first), and the picker.
  const selection = $derived(
    $forwardSelection?.room === room.id && $forwardSelection.thread === thread
      ? $forwardSelection
      : null,
  );
  const pickable = $derived(rows.filter(forwardable));
  const picked = $derived(
    selection
      ? selection.ids.flatMap((id) => {
          const message =
            pickable.find((item) => item.id === id) ?? selection.messages[id];
          return message ? [message] : [];
        })
      : [],
  );
  // Another room or thread (or a room without forward) ends selection mode.
  $effect(() => {
    if ($forwardSelection && (!selection || !actions.forward)) stopForward();
  });
  onMount(() => () => {
    if ($forwardSelection?.room === room.id) stopForward();
  });
  function leaveSelection(event: KeyboardEvent) {
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      !selection ||
      $forwardPicking
    )
      return;
    event.preventDefault();
    stopForward();
  }
  const footers = $derived(messageFooters(room, thread, now));
  const workers = $derived(threadWorkers(room, thread, now));
  const epic = $derived(room.epics.find((e) => e.id === thread));
  /** A sub-thread's origin is a message in its parent thread (Gui #6781): the link names that thread. */
  const originThread = $derived(
    origin && origin.thread !== "main"
      ? room.epics.find((e) => e.id === origin.thread)?.title
      : undefined,
  );
  // Work taken from here to an epic: the banner names that epic (and opens it) instead of "on this".
  const moved = $derived(
    workers[0]?.epic && workers.every((w) => w.epic?.id === workers[0].epic?.id)
      ? workers[0].epic
      : undefined,
  );
  const production = $derived(productionStatuses(room).get(thread));
  // "Thread criada · Desfazer" (Gimenes #4310): only in the thread that you just started from a message in main,
  // for THREAD_UNDO_MS, and only while nobody wrote in it.
  const undoable = $derived(
    !!origin &&
      replyCount === 0 &&
      $startedThread?.id === thread &&
      Date.now() - $startedThread.at < THREAD_UNDO_MS,
  );
  $effect(() => {
    const started = $startedThread;
    if (!started || started.id !== thread) return;
    const timer = setTimeout(
      () => startedThread.update((s) => (s?.id === started.id ? null : s)),
      Math.max(0, started.at + THREAD_UNDO_MS - Date.now()),
    );
    return () => clearTimeout(timer);
  });
  async function undoThread() {
    const from = origin;
    startedThread.set(null);
    const outcome = await actions.request({ t: "epic.del", id: thread });
    if (outcome.ok && from) actions.navigate(from.id, from.thread);
  }
  // A copy that takes in more than one message's text (names, avatars, marks,
  // reactions) becomes "[time, date] name: text" lines, as WhatsApp copies
  // (Gimenes #3955), each with only the selected part of the message's text.
  // A selection in one message's text, also one that ends past it, copies only
  // the selected text. Inside one message's text and in a field, the browser
  // copies as usual.
  function copySelection(event: ClipboardEvent) {
    const selection = window.getSelection();
    if (!event.clipboardData || !selection?.rangeCount || selection.isCollapsed)
      return;
    if (
      event.target instanceof Element &&
      event.target.closest(
        "input, textarea, [contenteditable]:not([contenteditable='false'])",
      )
    )
      return;
    const picked = selectedMessages(
      selection.getRangeAt(0),
      event.currentTarget as Element,
    );
    if (!picked) return;
    const byId = new Map(
      list
        .flatMap((m) => [m, ...(m.group ?? [])])
        .map((m) => [String(m.id), m]),
    );
    const only = picked.length === 1 ? picked[0] : null;
    const text =
      only && !only.head && only.text
        ? only.text
        : transcriptText(
            picked.flatMap((part) => {
              const m = byId.get(part.id);
              if (!m) return [];
              return [
                {
                  when: `${vb.hhmm(m.ts)}, ${new Date(m.ts).toLocaleDateString(vb.locale)}`,
                  who: messageAuthor(m, vb),
                  text: part.whole
                    ? m.text ||
                      m.files?.map((f) => f.name).join(", ") ||
                      part.text
                    : part.text,
                },
              ];
            }),
          );
    if (!text) return;
    event.clipboardData.setData("text/plain", text);
    event.preventDefault();
  }
</script>

<svelte:window onkeydown={leaveSelection} />
{#key room.id + ":" + thread}
  <section
    data-chat-timeline
    class="pb-4 font-sans text-sm text-foreground"
    oncopy={copySelection}
  >
    <!-- Older messages: a quiet line, not a button that stands out (Gimenes #6064). It loads them when it comes into
         view (an IntersectionObserver in chat-viewport/surface.ts, Gimenes #6078); a click does too. -->
    {#if more}<div class="flex justify-center p-2">
        <button
          type="button"
          id="olderBtn"
          data-chat-older
          aria-label={vb.t("Carregar mensagens anteriores")}
          class="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 font-sans text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          onclick={onloadolder}>{vb.t("Carregando…")}</button
        >
      </div>{/if}
    {#if origin}<div
        data-chat-origin
        class="mx-3 mt-3 mb-4 rounded-surface border border-border bg-muted/30"
      >
        <Message
          message={origin}
          origin
          typing={room.typing[origin.id]}
          {vb}
          {room}
          {actions}
        />
        <div
          class="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground"
        >
          {#if undoable}<span
              data-thread-undo
              role="status"
              class="flex items-center gap-1 text-foreground"
              ><Icon icon="check-circle" size={14} />{vb.t(
                "Thread criada",
              )}<Button
                variant="link"
                size="sm"
                class="h-auto px-1"
                onclick={undoThread}>{vb.t("Desfazer")}</Button
              ></span
            >{:else}<span
              >{replyCount === 1
                ? vb.t("1 resposta")
                : vb.t("{n} respostas", { n: replyCount })}</span
            >{/if}<Button
            variant="ghost"
            size="sm"
            data-origin-id={origin.id}
            onclick={() => actions.navigate(origin!.id, origin!.thread)}
            >{origin.thread === "main" || !originThread
              ? vb.t("ver na sala principal")
              : vb.t("ver em “{thread}”", { thread: originThread })} ↩</Button
          >
        </div>
      </div>{/if}
    {#if rows.length}{#each rows as message, i (message.id)}{@const before = i
          ? rows[i - 1]
          : previous}{#if newDay(before, message)}<div
            data-day-divider
            role="separator"
            class="my-3 flex items-center gap-3 px-3 text-xs font-medium text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border"
          >
            {dayLabel(message.ts, Date.now(), vb.locale, (text) => vb.t(text))}
          </div>{/if}{#if message.tag === "call"}<CallLine
            {message}
            {room}
            {vb}
          />{:else}<Message
            {message}
            previous={newDay(before, message) ? undefined : before}
            typing={room.typing[message.id]}
            {vb}
            {room}
            {actions}
            footer={footers.get(message.id)}
            onpick={(id, shift) => clickForward(pickable, id, shift)}
          />{/if}{/each}
    {:else if !workers.length}<p
        data-chat-empty
        class="m-0 p-6 text-center leading-6 text-muted-foreground"
      >
        {thread === "main"
          ? vb
              .t(
                "Comece a conversa. Os agents ligados nesta sala leem e respondem; o seu age com o seu OK. Ex.: <i>organiza o projeto em threads: site novo, aluguéis e domínio</i>.",
              )
              .replace(/<\/?i>/g, "")
          : thread === CALL_THREAD
            ? vb.t("Chat da call. Fica para as próximas calls desta sala.")
            : vb.t(
                "Discussão desta thread. Os agents leem as tarefas, o doc e a sala principal.",
              )}
      </p>{/if}
    {#if workers.length}<!-- Who is working here, in the agent's own color (a full block, like its tile): the agent is the
         squircle, the person it works for the small round picture on its corner. -->
      <div
        data-chat-working
        data-agent-tile={agentProvider(workers[0].who)}
        class={[
          "mx-3 mt-4 flex items-center gap-3 rounded-surface px-4 py-3",
          AGENT_TILES[agentProvider(workers[0].who)],
        ]}
      >
        <!-- One squircle per kind of agent (two Claudes are still one ✻), with the people they work for stacked on its corner. -->
        <div class="flex shrink-0 items-end">
          <span class="flex -space-x-1.5">
            {#each [...new Set(workers.map( (w) => agentProvider(w.who) ))].slice(0, 3) as provider (provider)}<span
                aria-hidden="true"
                data-avatar="agent"
                class="grid size-8 place-items-center rounded-[0.625rem] bg-current/15 text-base leading-none"
                >{agentMark(
                  workers.find((w) => agentProvider(w.who) === provider)?.who,
                )}</span
              >{/each}
          </span>
          <span class="-mb-1 -ml-2.5 flex -space-x-1.5"
            >{#each [...new Set(workers.map((w) => w.email))].slice(0, 4) as email (email)}<PersonAvatar
                data-avatar="person"
                size="2xs"
                {email}
                version={vb.avatarVersion(email)}
                class="shadow-[0_0_0_2px_currentColor]"
              />{/each}</span
          >
        </div>
        <p class="m-0 min-w-0 flex-1 break-words font-medium">
          {workers
            .map((w) =>
              vb.t("{via} de {who}", {
                via: prettyModel(w.who),
                who: vb.name(w.email),
              }),
            )
            .join(", ")}
          {#if moved}{vb.t(
              workers.length === 1
                ? "está trabalhando em"
                : "estão trabalhando em",
            )}
            <button
              type="button"
              data-working-epic={moved.id}
              class="cursor-pointer border-0 bg-transparent p-0 font-sans font-semibold text-inherit underline decoration-current/40 underline-offset-2 hover:decoration-current focus-visible:outline-2 focus-visible:outline-current"
              onclick={() =>
                actions.navigateRich?.({ kind: "thread", id: moved.id })}
              >{moved.title}</button
            >{:else}{vb.t(
              workers.length === 1
                ? "está trabalhando nisso"
                : "estão trabalhando nisso",
            )}{/if}
        </p>
        <span aria-hidden="true" class="animate-spin motion-reduce:animate-none"
          >✻</span
        >
      </div>{/if}
    {#if epic?.done}<div
        data-chat-end
        class="mx-3 mt-4 space-y-1 rounded-surface border border-border p-4"
      >
        <p class="m-0 font-medium">✓ {vb.t("Agent fez")}</p>
        <p class="m-0 text-xs text-muted-foreground">
          {vb.t("Escreva aqui pra continuar: ele reabre.")}
        </p>
      </div>{/if}
    {#if epic?.prod}<div
        data-chat-production
        class="mx-3 mt-3 space-y-1 rounded-surface border border-border p-4"
      >
        <p class="m-0 font-medium">
          {production === "changes"
            ? `🚀↻ ${vb.t("Uma versão está no ar · correções em andamento")}`
            : epic.prod.stage === "verified"
              ? `✓✓ ${vb.t("Verificado em prod")}`
              : `🚀 ${vb.t("No ar")}`}
        </p>
        {#if production === "changes"}<p
            class="m-0 text-xs text-muted-foreground"
          >
            {vb.t(
              "Você pediu mudanças depois desse deploy; a próxima versão ainda não subiu.",
            )}
          </p>{:else if epic.prod.stage === "verified" && epic.prod.note}<p
            class="m-0 whitespace-pre-wrap break-words text-xs text-muted-foreground"
          >
            {epic.prod.note}
          </p>{:else if epic.prod.stage !== "verified"}<p
            class="m-0 text-xs text-muted-foreground"
          >
            {vb.t("Falta o agent verificar em prod.")}
          </p>{/if}
      </div>{/if}
  </section>
{/key}
<!-- The bar of selection mode is in the composer's place (RoomScene); its Encaminhar opens this picker. -->
{#if actions.forward && (selection || $forwardPicking)}<ForwardPicker
    bind:open={$forwardPicking}
    port={actions.forward}
    messages={picked}
    ranged={selection?.ranged ?? false}
    {vb}
    ondone={stopForward}
  />{/if}
