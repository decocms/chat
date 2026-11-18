<script lang="ts">
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { untrack, tick } from "svelte";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import { X } from "../../lib/studio/icons";
  import Icon from "../../lib/studio/Icon.svelte";
  import AgentMark from "../../lib/components/AgentMark.svelte";
  import Badge from "../../lib/studio/Badge.svelte";
  import ErrorState from "../../lib/components/ErrorState.svelte";
  import type { ApplicationInbox, InboxBinding } from "./inbox";
  import type { BrowserApplicationServices } from "./browser";
  import type { Wait } from "../../types";
  import { roomAvatarVersion } from "../room-scope/model";
  import { roomLabel } from "../home/model";
  import {
    roomInboxModel,
    inboxTopic,
    type RoomInboxMessage,
  } from "./roomInboxModel";
  let {
    owner,
    binding,
    services,
    documentWidth,
    sidebarCollapsed = false,
  }: {
    owner: ApplicationInbox;
    binding: InboxBinding;
    services: BrowserApplicationServices;
    documentWidth: (node: HTMLElement) => () => void;
    sidebarCollapsed?: boolean;
  } = $props();
  const opening = untrack(() => binding),
    inbox = untrack(() => owner.state),
    root = untrack(() => services.rootRoom.state),
    personal = untrack(() => services.personal.state);
  const t = untrack(() => services.t);
  const model = $derived(
    roomInboxModel($inbox.data, opening.roomId ?? "", $inbox.all),
  );
  let error = $state("");
  const current = () => owner.owns(opening);
  const name = (message: RoomInboxMessage) =>
    message.kind === "claude"
      ? t("Seu Claude")
      : message.author === "ai"
        ? "@vibe"
        : message.authorName ||
          $root.room?.names?.[message.author] ||
          ($personal.me?.email === message.author
            ? $personal.me.name
            : $personal.me?.friends.find(
                (friend) => friend.email === message.author,
              )?.name) ||
          message.author.split("@")[0]!;
  const day = (ts: number) =>
    new Intl.DateTimeFormat(services.locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(ts);
  const when = (ts: number) =>
    new Intl.DateTimeFormat(services.locale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(ts);
  const avatar = (email: string) =>
    roomAvatarVersion($root.room, $personal.me, email);
  const topic = (message: RoomInboxMessage) =>
    inboxTopic(message, $root.room) ?? t("sala principal");
  const status = (value: string) =>
    value === "doing"
      ? t("fazendo")
      : value === "review"
        ? t("revisar")
        : value === "todo"
          ? t("a fazer")
          : value;
  const newDay = (index: number) => {
    const previous = model.messages[index - 1],
      row = model.messages[index];
    return !!row && (!previous || day(row.ts) !== day(previous.ts));
  };
  function go(message: RoomInboxMessage) {
    if (!current()) return;
    if (message.wait) owner.openWait(opening, message.wait);
    else if (message.mention) owner.openMention(opening, message.mention);
  }
  async function resolve(wait: Wait) {
    if (!current()) return;
    error = "";
    try {
      await owner.resolve(opening, wait);
    } catch {
      if (current()) error = t("Não deu pra resolver agora. Tente de novo.");
    }
  }
  async function close(event: MouseEvent) {
    if (
      !(event.currentTarget instanceof HTMLElement) ||
      !event.currentTarget.isConnected ||
      !current()
    )
      return;
    const oldFocus = document.activeElement;
    owner.close(opening);
    await tick();
    if (
      document.activeElement === document.body ||
      document.activeElement === oldFocus
    )
      owner.restoreFocus(opening);
  }
  function width(node: HTMLElement) {
    return { destroy: documentWidth(node) };
  }
</script>

<section
  data-native-room-inbox
  aria-label={t("Caixa de entrada")}
  class="grid h-full min-h-0 min-w-0 grid-cols-1 overflow-auto bg-background font-sans text-foreground md:grid-cols-[minmax(0,1fr)_auto] md:overflow-hidden"
>
  <div data-room-inbox-chat class="flex min-h-0 min-w-0 flex-col">
    <header
      class="flex flex-wrap items-center gap-3 border-b border-border p-4"
    >
      <h2 class="font-sans tracking-normal m-0 flex-1 text-lg font-semibold">
        {t("Caixa de entrada")}
      </h2>
      <Button
        size="sm"
        variant={!$inbox.all ? "secondary" : "ghost"}
        aria-pressed={!$inbox.all}
        onclick={(event) => {
          if (event.currentTarget.isConnected && current())
            owner.tab(opening, false);
        }}>{t("Esta sala")}</Button
      >
      <Button
        size="sm"
        variant={$inbox.all ? "secondary" : "ghost"}
        aria-pressed={$inbox.all}
        onclick={(event) => {
          if (event.currentTarget.isConnected && current())
            owner.tab(opening, true);
        }}>{t("Todas")}</Button
      >
      <IconButton
        data-native-room-inbox-close
        label={t("Fechar")}
        onclick={(event) => {
          void close(event);
        }}><Icon icon={X} size={16} /></IconButton
      >
    </header>
    <div class="min-h-0 flex-1 space-y-2 overflow-auto p-4">
      {#if $inbox.phase === "loading"}<p role="status">
          {t("Carregando…")}
        </p>{/if}
      {#if $inbox.error}<ErrorState
          title={t("Não foi possível carregar a caixa de entrada.")}
          compact
          onretry={() => {
            if (current()) void owner.refresh(opening);
          }}
          retryLabel={t("Tentar de novo")}
        />{/if}
      {#if error}<ErrorState title={error} compact />{/if}
      {#each model.messages as message, index (message.wait ?? message.mention ?? message)}
        {#if newDay(index)}<p
            class="my-3 text-center text-xs text-muted-foreground"
          >
            {day(message.ts)}
          </p>{/if}
        <Snapshot value={message}
          >{#snippet children(row)}
            <article
              data-room-inbox-message
              class="rounded-surface bg-card p-1 shadow-edge"
            >
              <Button
                variant="ghost"
                class="h-auto w-full items-start justify-start gap-3 rounded-lg p-2 text-left font-normal leading-5 whitespace-normal"
                onclick={(event) => {
                  if (event.currentTarget.isConnected) go(row);
                }}
              >
                {#if row.kind === "claude"}<AgentMark
                    class="text-sm"
                  />{:else if row.author === "ai"}<AgentMark
                    mark="✦"
                    class="text-sm text-foreground"
                  />{:else}<PersonAvatar
                    data-avatar="person"
                    size="sm"
                    email={row.author}
                    version={avatar(row.author)}
                  />{/if}
                <span class="grid min-w-0 flex-1 gap-1">
                  <span
                    ><strong class="font-medium">{name(row)}</strong>
                    <span class="text-xs text-muted-foreground"
                      >{when(row.ts)}</span
                    ></span
                  >
                  {#if row.kind !== "mention"}<span
                      class="inline-flex items-center gap-1.5 text-xs font-medium text-foreground"
                      ><span
                        aria-hidden="true"
                        class="size-1.5 rounded-full bg-brand"
                      ></span>{t(
                        row.kind === "ask"
                          ? "esperando você"
                          : "seu Claude espera você",
                      )}</span
                    >{/if}
                  <span class="text-xs text-muted-foreground"
                    >{$inbox.all
                      ? `${roomLabel($personal.me, row.book, row.room, services.language)} › `
                      : ""}{topic(row) || t("épico")}</span
                  >
                  <span class="line-clamp-6 break-words whitespace-pre-wrap"
                    >{row.text}</span
                  >
                </span>
              </Button>
              {#if row.wait?.ref.startsWith("m")}<Button
                  size="sm"
                  variant="outline"
                  class="mb-1 ml-[52px]"
                  onclick={(event) => {
                    if (event.currentTarget.isConnected && row.wait)
                      void resolve(row.wait);
                  }}>{t("Resolvido")}</Button
                >{/if}
            </article>
          {/snippet}</Snapshot
        >
      {:else}<p class="p-4 text-center text-muted-foreground">
          {t(
            $inbox.all
              ? "Nada esperando você. ✓"
              : "Nada esperando você nesta sala. ✓",
          )}
        </p>{/each}
    </div>
  </div>
  <aside
    use:width
    data-room-inbox-doc
    class={[
      "min-h-0 w-full min-w-0 space-y-4 overflow-auto border-t border-border bg-card p-5 md:border-t-0 md:border-l",
      sidebarCollapsed
        ? "md:animate-room-document-width-rail"
        : "md:animate-room-document-width",
    ]}
  >
    <h1 class="font-sans tracking-normal m-0 text-2xl font-semibold">
      {t("O que é seu")}
    </h1>
    <p class="text-muted-foreground">
      {t("Tarefas suas e o que espera seu OK. Clique pra abrir.")}
    </p>
    {#if model.oks.length}<h3
        class="font-sans tracking-normal m-0 text-sm font-semibold"
      >
        {t("Esperando seu OK")}
      </h3>
      <ul class="m-0 list-none space-y-2 p-0">
        {#each model.oks as wait (wait)}<Snapshot value={wait}
            >{#snippet children(row)}<li class="flex items-center gap-2">
                <Badge class="text-foreground" variant="warning"
                  >{t("revisar")}</Badge
                ><Button
                  variant="ghost"
                  class="h-auto flex-1 justify-start whitespace-normal text-left rounded-lg font-normal"
                  onclick={(event) => {
                    if (event.currentTarget.isConnected && current())
                      owner.openWait(opening, row);
                  }}>{row.text}</Button
                >
              </li>{/snippet}</Snapshot
          >{/each}
      </ul>{/if}
    <h3 class="font-sans tracking-normal m-0 text-sm font-semibold">
      {t("Suas tarefas")}
    </h3>
    {#each model.groups as group (`${group.bookId}/${group.epicId}`)}
      <h4 class="font-sans tracking-normal m-0 text-sm font-semibold">
        {#key group.first}<Snapshot value={group.first}
            >{#snippet children(row)}<Button
                variant="ghost"
                size="sm"
                class="h-auto p-0 text-left rounded-lg font-normal"
                onclick={(event) => {
                  if (event.currentTarget.isConnected && current())
                    owner.openTask(opening, row);
                }}
                >{group.epic || t("sala principal")}{#if $inbox.all}<span>
                    · {roomLabel(
                      $personal.me,
                      group.bookId,
                      group.room,
                      services.language,
                    )}</span
                  >{/if}</Button
              >{/snippet}</Snapshot
          >{/key}
      </h4>
      <ul class="m-0 list-none space-y-2 p-0">
        {#each group.tasks as task (task)}<Snapshot value={task}
            >{#snippet children(row)}<li
                class="flex flex-wrap items-center gap-2"
              >
                <Badge
                  class="text-foreground"
                  variant={row.status === "review" ? "warning" : "neutral"}
                  >{status(row.status)}</Badge
                ><Button
                  variant="ghost"
                  class="h-auto min-w-0 flex-1 justify-start whitespace-normal text-left rounded-lg font-normal"
                  onclick={(event) => {
                    if (event.currentTarget.isConnected && current())
                      owner.openTask(opening, row);
                  }}>{row.title}</Button
                >{#if row.due}<span class="text-xs">{row.due}</span>{/if}
              </li>{/snippet}</Snapshot
          >{/each}
      </ul>
    {:else}<p class="text-muted-foreground">
        {t("Nenhuma tarefa aberta sua.")}
      </p>{/each}
  </aside>
</section>
