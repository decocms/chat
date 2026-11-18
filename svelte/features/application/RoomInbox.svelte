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
  class="tw:grid tw:h-full tw:min-h-0 tw:min-w-0 tw:grid-cols-1 tw:overflow-auto tw:bg-background tw:font-sans tw:text-foreground tw:min-[901px]:grid-cols-[minmax(0,1fr)_auto] tw:min-[901px]:overflow-hidden"
>
  <div data-room-inbox-chat class="tw:flex tw:min-h-0 tw:min-w-0 tw:flex-col">
    <header
      class="tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:border-b tw:border-border tw:p-4"
    >
      <h2
        class="tw:font-sans tw:tracking-normal tw:m-0 tw:flex-1 tw:text-lg tw:font-semibold"
      >
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
    <div class="tw:min-h-0 tw:flex-1 tw:space-y-2 tw:overflow-auto tw:p-4">
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
            class="tw:my-3 tw:text-center tw:text-xs tw:text-muted-foreground"
          >
            {day(message.ts)}
          </p>{/if}
        <Snapshot value={message}
          >{#snippet children(row)}
            <article
              data-room-inbox-message
              class="tw:rounded-surface tw:bg-card tw:p-1 tw:shadow-edge"
            >
              <Button
                variant="ghost"
                class="tw:h-auto tw:w-full tw:items-start tw:justify-start tw:gap-3 tw:rounded-lg tw:p-2 tw:text-left tw:font-normal tw:leading-5 tw:whitespace-normal"
                onclick={(event) => {
                  if (event.currentTarget.isConnected) go(row);
                }}
              >
                {#if row.kind === "claude"}<AgentMark
                    class="tw:text-sm"
                  />{:else if row.author === "ai"}<AgentMark
                    mark="✦"
                    class="tw:text-sm tw:text-foreground"
                  />{:else}<PersonAvatar
                    data-avatar="person"
                    size="sm"
                    email={row.author}
                    version={avatar(row.author)}
                  />{/if}
                <span class="tw:grid tw:min-w-0 tw:flex-1 tw:gap-1">
                  <span
                    ><strong class="tw:font-medium">{name(row)}</strong>
                    <span class="tw:text-xs tw:text-muted-foreground"
                      >{when(row.ts)}</span
                    ></span
                  >
                  {#if row.kind !== "mention"}<span
                      class="tw:inline-flex tw:items-center tw:gap-1.5 tw:text-xs tw:font-medium tw:text-foreground"
                      ><span
                        aria-hidden="true"
                        class="tw:size-1.5 tw:rounded-full tw:bg-brand"
                      ></span>{t(
                        row.kind === "ask"
                          ? "esperando você"
                          : "seu Claude espera você",
                      )}</span
                    >{/if}
                  <span class="tw:text-xs tw:text-muted-foreground"
                    >{$inbox.all
                      ? `${roomLabel($personal.me, row.book, row.room, services.language)} › `
                      : ""}{topic(row) || t("épico")}</span
                  >
                  <span
                    class="tw:line-clamp-6 tw:break-words tw:whitespace-pre-wrap"
                    >{row.text}</span
                  >
                </span>
              </Button>
              {#if row.wait?.ref.startsWith("m")}<Button
                  size="sm"
                  variant="outline"
                  class="tw:mb-1 tw:ml-[52px]"
                  onclick={(event) => {
                    if (event.currentTarget.isConnected && row.wait)
                      void resolve(row.wait);
                  }}>{t("Resolvido")}</Button
                >{/if}
            </article>
          {/snippet}</Snapshot
        >
      {:else}<p class="tw:p-4 tw:text-center tw:text-muted-foreground">
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
      "tw:min-h-0 tw:w-full tw:min-w-0 tw:space-y-4 tw:overflow-auto tw:border-t tw:border-border tw:bg-card tw:p-5 tw:min-[901px]:border-t-0 tw:min-[901px]:border-l",
      sidebarCollapsed
        ? "tw:min-[901px]:animate-room-document-width-rail"
        : "tw:min-[901px]:animate-room-document-width",
    ]}
  >
    <h1
      class="tw:font-sans tw:tracking-normal tw:m-0 tw:text-2xl tw:font-semibold"
    >
      {t("O que é seu")}
    </h1>
    <p class="tw:text-muted-foreground">
      {t("Tarefas suas e o que espera seu OK. Clique pra abrir.")}
    </p>
    {#if model.oks.length}<h3
        class="tw:font-sans tw:tracking-normal tw:m-0 tw:text-sm tw:font-semibold"
      >
        {t("Esperando seu OK")}
      </h3>
      <ul class="tw:m-0 tw:list-none tw:space-y-2 tw:p-0">
        {#each model.oks as wait (wait)}<Snapshot value={wait}
            >{#snippet children(row)}<li
                class="tw:flex tw:items-center tw:gap-2"
              >
                <Badge class="tw:text-foreground" variant="warning"
                  >{t("revisar")}</Badge
                ><Button
                  variant="ghost"
                  class="tw:h-auto tw:flex-1 tw:justify-start tw:whitespace-normal tw:text-left tw:rounded-lg tw:font-normal"
                  onclick={(event) => {
                    if (event.currentTarget.isConnected && current())
                      owner.openWait(opening, row);
                  }}>{row.text}</Button
                >
              </li>{/snippet}</Snapshot
          >{/each}
      </ul>{/if}
    <h3
      class="tw:font-sans tw:tracking-normal tw:m-0 tw:text-sm tw:font-semibold"
    >
      {t("Suas tarefas")}
    </h3>
    {#each model.groups as group (`${group.bookId}/${group.epicId}`)}
      <h4
        class="tw:font-sans tw:tracking-normal tw:m-0 tw:text-sm tw:font-semibold"
      >
        {#key group.first}<Snapshot value={group.first}
            >{#snippet children(row)}<Button
                variant="ghost"
                size="sm"
                class="tw:h-auto tw:p-0 tw:text-left tw:rounded-lg tw:font-normal"
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
      <ul class="tw:m-0 tw:list-none tw:space-y-2 tw:p-0">
        {#each group.tasks as task (task)}<Snapshot value={task}
            >{#snippet children(row)}<li
                class="tw:flex tw:flex-wrap tw:items-center tw:gap-2"
              >
                <Badge
                  class="tw:text-foreground"
                  variant={row.status === "review" ? "warning" : "neutral"}
                  >{status(row.status)}</Badge
                ><Button
                  variant="ghost"
                  class="tw:h-auto tw:min-w-0 tw:flex-1 tw:justify-start tw:whitespace-normal tw:text-left tw:rounded-lg tw:font-normal"
                  onclick={(event) => {
                    if (event.currentTarget.isConnected && current())
                      owner.openTask(opening, row);
                  }}>{row.title}</Button
                >{#if row.due}<span class="tw:text-xs">{row.due}</span>{/if}
              </li>{/snippet}</Snapshot
          >{/each}
      </ul>
    {:else}<p class="tw:text-muted-foreground">
        {t("Nenhuma tarefa aberta sua.")}
      </p>{/each}
  </aside>
</section>
