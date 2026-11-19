<script lang="ts">
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { onMount } from "svelte";
  import Message from "./Message.svelte";
  import type { ChatProps } from "../../app/chatTypes";
  import {
    foldMessages,
    newDay,
    dayLabel,
    messageFooters,
    threadWorkers,
    prettyModel,
  } from "./model";
  import Button from "../../lib/studio/Button.svelte";
  import AgentMark from "../../lib/components/AgentMark.svelte";
  import {
    AGENT_TILES,
    agentMark,
    agentProvider,
  } from "../../lib/components/agent";
  import { productionStatuses } from "./production";
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
  // "O que precisa de mim aqui" (Gui #3011): your latest ask in this thread, answered by your Claude; only you get it.
  const brief = $derived(
    room.briefs?.filter((item) => item.thread === thread).at(-1),
  );
  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => {
      now = Date.now();
    }, 30_000);
    return () => clearInterval(timer);
  });
  const rows = $derived(foldMessages(list));
  const footers = $derived(messageFooters(room, thread, now));
  const workers = $derived(threadWorkers(room, thread, now));
  const epic = $derived(room.epics.find((e) => e.id === thread));
  // Work taken from here to an epic: the banner names that epic (and opens it) instead of "on this".
  const moved = $derived(
    workers[0]?.epic && workers.every((w) => w.epic?.id === workers[0].epic?.id)
      ? workers[0].epic
      : undefined,
  );
  const production = $derived(productionStatuses(room).get(thread));
</script>

{#key room.id + ":" + thread}
  <section data-chat-timeline class="pb-4 font-sans text-sm text-foreground">
    {#if more}<div class="flex justify-center p-3">
        <Button variant="outline" size="sm" id="olderBtn" onclick={onloadolder}
          >{vb.t("Carregar mensagens anteriores")}</Button
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
          <span
            >{replyCount === 1
              ? vb.t("1 resposta")
              : vb.t("{n} respostas", { n: replyCount })}</span
          ><Button
            variant="ghost"
            size="sm"
            data-origin-id={origin.id}
            onclick={() => actions.navigate(origin!.id, origin!.thread)}
            >{vb.t("ver na sala principal")} ↩</Button
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
          </div>{/if}<Message
          {message}
          previous={newDay(before, message) ? undefined : before}
          typing={room.typing[message.id]}
          {vb}
          {room}
          {actions}
          footer={footers.get(message.id)}
        />{/each}
    {:else if !workers.length}<p
        data-chat-empty
        class="m-0 p-6 text-center leading-6 text-muted-foreground"
      >
        {thread === "main"
          ? vb
              .t(
                "Comece a conversa. Os agents ligados nesta sala leem e respondem; o seu age com o seu OK. Ex.: <i>organiza o projeto em épicos: site novo, aluguéis e domínio</i>.",
              )
              .replace(/<\/?i>/g, "")
          : vb.t(
              "Discussão deste épico. Os agents leem as tarefas, o doc e a sala principal.",
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
    {#if epic?.archived}<div
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
    {#if brief}<section
        data-brief
        aria-label={vb.t("O que precisa de mim aqui?")}
        class="mx-3 mt-4 space-y-1.5 rounded-surface border border-dashed border-border bg-muted/40 p-3"
      >
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <AgentMark size="2xs" />
          <b class="font-semibold">{vb.t("O que precisa de mim aqui?")}</b>
          <span class="rounded-full bg-muted px-2 py-0.5"
            >{vb.t("só você vê")}</span
          >
          <span class="flex-1"></span><Button
            size="sm"
            variant="ghost"
            onclick={(event) => {
              if (event.currentTarget.isConnected)
                void actions.request({ t: "brief.dismiss", id: brief.id });
            }}>{vb.t("Dispensar")}</Button
          >
        </div>
        {#if brief.text}<p
            data-brief-text
            class="m-0 whitespace-pre-wrap break-words text-sm leading-6"
          >
            {brief.text}
          </p>
          <p class="m-0 text-xs text-muted-foreground">
            {brief.answered_at
              ? [
                  brief.model ? prettyModel(brief.model) : "",
                  new Date(brief.answered_at).toLocaleTimeString(
                    vb.locale || "pt-BR",
                    { hour: "2-digit", minute: "2-digit" },
                  ),
                ]
                  .filter(Boolean)
                  .join(" · ")
              : ""}
          </p>{:else}<p role="status" class="m-0 text-sm text-muted-foreground">
            {vb.t("Pedi pro seu Claude… ele responde quando estiver ouvindo.")}
          </p>{/if}
      </section>{/if}
  </section>
{/key}
