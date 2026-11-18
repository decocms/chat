<script lang="ts">
  import PersonAvatar from "./lib/components/PersonAvatar.svelte";
  import { untrack } from "svelte";
  import type { Wait, InboxMention, InboxTask, Bridge } from "./types";
  import { uiNavigationUrl } from "../shared/uiVariant";
  import Dialog from "./lib/studio/Dialog.svelte";
  import DialogContent from "./lib/studio/DialogContent.svelte";
  import DialogHeader from "./lib/studio/DialogHeader.svelte";
  import DialogTitle from "./lib/studio/DialogTitle.svelte";
  import Icon from "./lib/studio/Icon.svelte";
  import IconButton from "./lib/studio/IconButton.svelte";
  import Spinner from "./lib/studio/Spinner.svelte";
  import Tabs from "./lib/studio/Tabs.svelte";
  import TabsContent from "./lib/studio/TabsContent.svelte";
  import TabsList from "./lib/studio/TabsList.svelte";
  import TabsTrigger from "./lib/studio/TabsTrigger.svelte";
  import { Calendar, Check } from "./lib/studio/icons";
  import AgentMark from "./lib/components/AgentMark.svelte";
  import EmptyState from "./lib/components/EmptyState.svelte";
  import ErrorState from "./lib/components/ErrorState.svelte";

  let {
    waits,
    mentions = [],
    tasks = [],
    roomId,
    all: startAll = false,
    vb,
    avatarVersion,
    displayName,
    roomLabel = (_roomId: string, title: string) => title,
    ontab,
    onopen,
    onnav,
    onmention,
    ontask,
    loading = false,
    readError = false,
    current = () => true,
    onretry,
    onresolve,
    onclose,
  }: {
    waits: Wait[];
    mentions?: InboxMention[];
    tasks?: InboxTask[];
    roomId: string | null;
    all?: boolean;
    vb: Pick<Bridge, "t" | "ago">;
    avatarVersion?: (email: string) => number | null | undefined;
    displayName?: (email: string) => string;
    /** A room's name in the All tab (a DM reads as the other person: home/model `roomLabel`). */
    roomLabel?: (roomId: string, title: string) => string;
    ontab?: (all: boolean) => void;
    onopen: (wait: Wait, event: MouseEvent) => void;
    onnav?: (bookId: string, thread: string, msgId: number) => void;
    onmention?: (mention: InboxMention) => void;
    ontask?: (task: InboxTask) => void;
    loading?: boolean;
    readError?: boolean;
    current?: () => boolean;
    onretry?: () => void | Promise<void>;
    onresolve: (wait: Wait) => void | Promise<void>;
    onclose: () => void;
  } = $props();
  let selected = $state(untrack(() => (startAll || !roomId ? "all" : "room")));
  let open = $state(true);
  let pending = $state<string | null>(null);
  let error = $state("");
  const showAll = $derived(selected === "all" || !roomId);
  const mine = <T extends { book_id: string }>(xs: T[]) =>
    showAll ? xs : xs.filter((x) => x.book_id === roomId);
  const waitList = $derived(mine(waits));
  const mentionList = $derived(mine(mentions));
  const taskList = $derived(mine(tasks));
  const total = (scopeAll: boolean) => {
    const f = <T extends { book_id: string }>(xs: T[]) =>
      scopeAll ? xs.length : xs.filter((x) => x.book_id === roomId).length;
    return f(waits) + f(mentions) + f(tasks);
  };
  const items = $derived([
    { value: "room", label: `${vb.t("Esta sala")} (${total(false)})` },
    { value: "all", label: `${vb.t("Todas")} (${total(true)})` },
  ]);
  const anything = $derived(
    waitList.length + mentionList.length + taskList.length > 0,
  );
  const key = (wait: Wait) => `${wait.book_id}:${wait.ref}`;
  const kind = (wait: Wait) =>
    wait.ref.startsWith("t")
      ? "task"
      : /^[ab]/.test(wait.ref)
        ? "agent"
        : "ask";
  const author = (a: string, name: string | null) =>
    name || displayName?.(a) || a.split("@")[0];
  const statusLabel = (s: string) =>
    s === "doing"
      ? vb.t("fazendo")
      : s === "review"
        ? vb.t("revisar")
        : vb.t("a fazer");
  function waitHref(wait: Wait) {
    const path = `/b/${encodeURIComponent(wait.book_id)}${wait.thread === "main" ? "" : `?t=${encodeURIComponent(wait.thread)}`}${/^[mab]/.test(wait.ref) ? `#m${wait.ref.slice(1)}` : ""}`;
    return uiNavigationUrl(path, window.location.href, "svelte");
  }
  function navHref(bookId: string, thread: string, msgId: number) {
    const path = `/b/${encodeURIComponent(bookId)}${thread && thread !== "main" ? `?t=${encodeURIComponent(thread)}` : ""}${msgId ? `#m${msgId}` : ""}`;
    return uiNavigationUrl(path, window.location.href, "svelte");
  }
  function clickNav(
    event: MouseEvent,
    bookId: string,
    thread: string,
    msgId: number,
  ) {
    if (!current()) {
      event.preventDefault();
      return;
    }
    if (
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    if (!onnav) return; // no handler: let the anchor's href navigate
    event.preventDefault();
    onnav(bookId, thread, msgId);
  }
  async function resolve(wait: Wait) {
    if (!current()) return;
    pending = key(wait);
    error = "";
    try {
      await onresolve(wait);
    } catch {
      error = vb.t("Não deu pra resolver agora. Tente de novo.");
    } finally {
      pending = null;
    }
  }
</script>

<Dialog
  bind:open
  onOpenChange={(value) => {
    if (!value && current()) onclose();
  }}
>
  <DialogContent
    data-vb-native
    data-native-inbox
    class="font-sans text-sm text-foreground"
    closeLabel={vb.t("Fechar")}
    preventScroll={false}
    preventBodyPointerEvents={false}
    preventOverflowTextSelection={false}
  >
    <DialogHeader>
      <DialogTitle class="font-sans">{vb.t("Caixa de entrada")}</DialogTitle>
    </DialogHeader>
    {#if error}<ErrorState title={error} compact />{/if}
    {#if loading}<p role="status">{vb.t("Carregando…")}</p>{/if}
    {#if readError}<ErrorState
        title={vb.t("Não foi possível carregar a caixa de entrada.")}
        compact
        onretry={() => {
          if (current()) void onretry?.();
        }}
        retryLabel={vb.t("Tentar de novo")}
      />{/if}
    {#if roomId}
      <Tabs
        bind:value={selected}
        onValueChange={(value) => ontab?.(value === "all")}
      >
        <TabsList aria-label={vb.t("Caixa de entrada")}>
          {#each items as item (item.value)}<TabsTrigger value={item.value}
              >{item.label}</TabsTrigger
            >{/each}
        </TabsList>
        {#each items as item (item.value)}<TabsContent value={item.value}
            >{@render content()}</TabsContent
          >{/each}
      </Tabs>
    {:else}{@render content()}{/if}
  </DialogContent>
</Dialog>

{#snippet content()}
  {#if anything}
    <div
      class="flex max-h-[62dvh] min-h-0 flex-col gap-4 overflow-auto overscroll-contain"
    >
      {#if waitList.length}
        <section>
          <h3
            class="m-0 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {vb.t("Esperando você")} ({waitList.length})
          </h3>
          <ul class="m-0 list-none divide-y divide-border p-0">
            {#each waitList as wait (key(wait))}
              <li class="flex items-start gap-2 py-1">
                <a
                  href={waitHref(wait)}
                  onclick={(event) => {
                    if (!current()) {
                      event.preventDefault();
                      return;
                    }
                    onopen(wait, event);
                  }}
                  class="flex min-w-0 flex-1 gap-3 rounded-control p-2 text-foreground no-underline outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {#if kind(wait) === "task"}<span
                      class="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-muted"
                      ><Icon icon={Check} size={16} /></span
                    >
                  {:else if kind(wait) === "agent"}<AgentMark class="text-sm" />
                  {:else if wait.author === "ai"}<AgentMark
                      mark="✦"
                      class="text-sm text-foreground"
                    />
                  {:else}<PersonAvatar
                      data-avatar="person"
                      size="sm"
                      email={wait.author}
                      version={avatarVersion?.(wait.author)}
                    />{/if}
                  <span
                    class="flex min-w-0 flex-1 flex-col gap-1 text-sm leading-5 [overflow-wrap:anywhere]"
                  >
                    <span class="line-clamp-3">
                      <strong class="font-semibold"
                        >{kind(wait) === "task"
                          ? vb.t("Tarefa sua esperando OK:")
                          : kind(wait) === "agent"
                            ? vb.t("Seu agent espera você:")
                            : `${author(wait.author, wait.author_name).split(" ")[0]}:`}</strong
                      >
                      {wait.text}
                    </span>
                    <span class="text-xs leading-4 text-muted-foreground"
                      >{showAll
                        ? `${roomLabel(wait.book_id, wait.room)} › `
                        : ""}{wait.topic || vb.t("sala principal")} · {vb.ago(
                        wait.ts,
                      )}</span
                    >
                  </span>
                </a>
                {#if wait.ref.startsWith("m")}
                  <IconButton
                    label={vb.t(
                      "Já resolvi (respondi em outro lugar, ou não é comigo)",
                    )}
                    class="mt-1"
                    aria-busy={pending === key(wait) || undefined}
                    disabled={pending !== null}
                    onclick={() => resolve(wait)}
                    >{#if pending === key(wait)}<Spinner
                        size="xs"
                      />{:else}<Icon icon={Check} />{/if}</IconButton
                  >
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if mentionList.length}
        <section>
          <h3
            class="m-0 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {vb.t("Te mencionaram")} ({mentionList.length})
          </h3>
          <ul class="m-0 list-none divide-y divide-border p-0">
            {#each mentionList as m (`${m.book_id}:${m.msg_id}`)}
              <li class="flex items-start gap-2 py-1">
                <a
                  href={navHref(m.book_id, m.thread, m.msg_id)}
                  onclick={(event) => {
                    if (!current()) {
                      event.preventDefault();
                      return;
                    }
                    if (
                      event.button !== 0 ||
                      event.ctrlKey ||
                      event.metaKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    if (onmention) {
                      event.preventDefault();
                      onmention(m);
                    } else clickNav(event, m.book_id, m.thread, m.msg_id);
                  }}
                  class="flex min-w-0 flex-1 gap-3 rounded-control p-2 text-foreground no-underline outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {#if m.author === "ai"}<AgentMark
                      mark="✦"
                      class="text-sm text-foreground"
                    />{:else}<PersonAvatar
                      data-avatar="person"
                      size="sm"
                      email={m.author}
                      version={avatarVersion?.(m.author)}
                    />{/if}
                  <span
                    class="flex min-w-0 flex-1 flex-col gap-1 text-sm leading-5 [overflow-wrap:anywhere]"
                  >
                    <span class="line-clamp-3">
                      <strong class="font-semibold"
                        >{author(m.author, m.author_name).split(
                          " ",
                        )[0]}:</strong
                      >
                      {m.text}
                    </span>
                    <span class="text-xs leading-4 text-muted-foreground"
                      >{showAll
                        ? `${roomLabel(m.book_id, m.room)} › `
                        : ""}{vb.ago(m.ts)}</span
                    >
                  </span>
                </a>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if taskList.length}
        <section>
          <h3
            class="m-0 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {vb.t("Suas tarefas")} ({taskList.length})
          </h3>
          <ul class="m-0 list-none divide-y divide-border p-0">
            {#each taskList as task (`${task.book_id}:${task.task_id}`)}
              <li class="flex items-start gap-2 py-1">
                <a
                  href={navHref(task.book_id, task.epic_id, 0)}
                  onclick={(event) => {
                    if (!current()) {
                      event.preventDefault();
                      return;
                    }
                    if (
                      event.button !== 0 ||
                      event.ctrlKey ||
                      event.metaKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    if (ontask) {
                      event.preventDefault();
                      ontask(task);
                    } else clickNav(event, task.book_id, task.epic_id, 0);
                  }}
                  class="flex min-w-0 flex-1 gap-3 rounded-control p-2 text-foreground no-underline outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    class="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-muted"
                    ><Icon icon={Calendar} size={16} /></span
                  >
                  <span
                    class="flex min-w-0 flex-1 flex-col gap-1 text-sm leading-5 [overflow-wrap:anywhere]"
                  >
                    <span class="line-clamp-3">{task.title}</span>
                    <span class="text-xs leading-4 text-muted-foreground"
                      >{showAll
                        ? `${roomLabel(task.book_id, task.room)} › `
                        : ""}{task.epic || vb.t("sala principal")} · {statusLabel(
                        task.status,
                      )}{task.due ? ` · ${task.due}` : ""}</span
                    >
                  </span>
                </a>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>
  {:else if !loading && !readError}<EmptyState
      title={showAll
        ? vb.t("Nada esperando você. ✓")
        : vb.t("Nada esperando você nesta sala. ✓")}
    />{/if}
{/snippet}
