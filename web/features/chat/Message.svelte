<script lang="ts">
  import { chatZone } from "./time";
  import { MESSAGE_AVATAR, MESSAGE_ROW } from "../room-shell/shape";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { onDestroy, tick } from "svelte";
  import DeferredInteractiveBody from "../chat-interactive/DeferredInteractiveBody.svelte";
  import RichContent from "../rich-text/RichContent.svelte";
  import type { RichMode } from "../rich-text/types";
  import type { Room } from "../../../shared/room";
  import type {
    ChatActions,
    ChatBridge,
    ChatMessage,
  } from "../../app/chatTypes";
  import {
    canEditMessage,
    canStartThread,
    startsThread,
    continues,
    issueParts,
    messageKind,
    messageAuthor,
    messageSnippet,
    newThreadId,
    reminderParts,
    threadTitle,
    type MessageFooter as Footer,
  } from "./model";
  import AgentMark from "../../lib/components/AgentMark.svelte";
  import { AGENT_NAMES, agentProvider } from "../../lib/components/agent";
  import Badge from "../../lib/studio/Badge.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import MessageActions from "./MessageActions.svelte";
  import MessageEditor from "./MessageEditor.svelte";
  import { editingMessage } from "./editing";
  import MessageFooter from "./MessageFooter.svelte";
  import MessageReactions from "./MessageReactions.svelte";
  import Attachments from "./Attachments.svelte";
  import ThreadCards from "../room-sidebar/ThreadCards.svelte";
  import { startedThread } from "./threadUndo";
  import { swipeMessage } from "./swipe";
  import PersonCard from "../profile/PersonCard.svelte";
  let {
    message: m,
    previous,
    origin = false,
    typing,
    vb,
    room,
    actions,
    footer,
  }: {
    message: ChatMessage;
    previous?: ChatMessage;
    origin?: boolean;
    typing?: string;
    vb: ChatBridge;
    room: Room;
    actions: ChatActions;
    footer?: Footer;
  } = $props();
  let actionController = $state<
    { copy: (link?: boolean) => Promise<void> } | undefined
  >();
  // The hover toolbar (8 reactions, reply, copy, link, each with a tooltip) was most of the time to show a room:
  // about 200 of 300 ms for 60 messages. It mounts on the first pointer or focus in the message.
  let toolbar = $state(false),
    article = $state<HTMLElement>(),
    // The phone's actions sheet (Gimenes #4402): a long press on the message opens it.
    sheet = $state(false);
  // "Criar thread" (Gimenes #4310): one click makes the thread and opens it. No title step: the title is the start
  // of the message (rename it later). A thread from a message in main offers "Desfazer" for a few seconds.
  let threadBusy = false,
    threadError = $state("");
  const threadable = $derived(!origin && canStartThread(room, m));
  const editable = $derived(!origin && canEditMessage(room, m));
  // Edited in place (like Discord): the text is a box until Enter or Esc; no toolbar meanwhile.
  const editing = $derived(
    editable &&
      $editingMessage?.room === room.id &&
      $editingMessage.id === m.id,
  );
  async function startThread() {
    if (threadBusy) return;
    threadBusy = true;
    threadError = "";
    // One id per click: a retry of the same create (a lost answer) does not make a second thread.
    const id = newThreadId();
    const title =
      threadTitle(m.text ?? "") ||
      threadTitle(messageSnippet(m, vb.t("votação"))) ||
      vb.t("Thread");
    const outcome = await actions.request({
      t: "epic",
      title,
      from: m.id,
      id,
    });
    threadBusy = false;
    if (!outcome.ok) {
      threadError = vb.t("Não deu pra criar a thread.");
      return;
    }
    // From inside a thread the server also writes a line in main, and an undo would leave it there: no undo.
    startedThread.set(m.thread === "main" ? { id, at: Date.now() } : null);
    actions.openThread?.(id);
  }
  function showToolbar() {
    toolbar = true;
  }
  /** Keyboard and screen readers: one cheap stop stands for the toolbar. Focus or a click mounts it and moves
   * focus into it: to its last button when focus came backwards (Shift+Tab) from after the message. */
  async function enterToolbar(event: FocusEvent | MouseEvent) {
    const from =
      "relatedTarget" in event ? (event.relatedTarget as Node | null) : null;
    const backwards =
      !!from &&
      !!article &&
      !article.contains(from) &&
      // 4 = Node.DOCUMENT_POSITION_FOLLOWING: focus came from an element after this message.
      !!(article.compareDocumentPosition(from) & 4);
    showToolbar();
    await tick();
    if (!active) return;
    const buttons = article?.querySelectorAll<HTMLElement>(
      "[data-message-toolbar] button",
    );
    (backwards ? buttons?.[buttons.length - 1] : buttons?.[0])?.focus();
  }
  let active = true;
  onDestroy(() => {
    active = false;
  });
  const waiting = $derived(vb.waiting(m.id));
  const fireHot = $derived(
    !origin &&
      m.kind === "agent" &&
      m.author === room.me &&
      actions.fireCard?.id === m.id &&
      actions.fireCard.hot,
  );
  let attention = $state(false),
    flash = $state(false);
  $effect(() => {
    if (!waiting) {
      attention = false;
      return;
    }
    attention = true;
    const timer = setTimeout(() => {
      attention = false;
    }, 1800);
    return () => clearTimeout(timer);
  });
  function highlight(node: HTMLElement) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = () => {
      if (timer) clearTimeout(timer);
      flash = true;
      timer = setTimeout(() => {
        flash = false;
      }, 1800);
    };
    node.addEventListener("vb:message-highlight", show);
    return {
      destroy() {
        node.removeEventListener("vb:message-highlight", show);
        if (timer) clearTimeout(timer);
      },
    };
  }
  // A reply always opens with its own header (and the quote line above it), like Discord.
  const continuous = $derived(!m.reply_to && continues(previous, m));
  const kind = $derived(messageKind(m));
  // Reactions go on people's and agents' messages, not on @vibe notices, issues or reminders.
  const reactable = $derived(
    !origin && kind !== "issue" && kind !== "notice" && kind !== "reminder",
  );
  const reacted = $derived(
    Object.values(m.reactions ?? {}).some((who) => who.length),
  );
  // Nothing under the message yet: no chips, no acks. Its row still keeps its height (the quick reactions show there on
  // hover), except on a phone, where there is no hover and the long-press sheet reacts.
  const bare = $derived(!footer && !reacted);
  const quote = $derived(
    m.reply_to
      ? [...room.messages, ...(room.origins || [])].find(
          (x) => x.id === m.reply_to,
        )
      : undefined,
  );
  const timestamp = $derived(
    vb.dateTime?.(m.ts) ?? new Date(m.ts).toLocaleString(),
  );
  const group = $derived(m.group || [m]);
  const reminder = $derived(reminderParts(m));
  // An agent's card usually comes with its title again as the message text (the fallback for notifications):
  // when the text is one line whose words are all in the card's title, the card alone says it.
  const words = (text: string) =>
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean);
  const echoesCard = $derived.by(() => {
    let title = "";
    try {
      // Only the root's title: the card itself is parsed (and checked) where it's drawn, in the deferred body.
      const raw = m.card ? (JSON.parse(m.card) as unknown) : null;
      if (
        raw &&
        typeof raw === "object" &&
        "root" in raw &&
        "elements" in raw
      ) {
        const { root, elements } = raw as {
          root: unknown;
          elements: Record<string, { props?: { title?: unknown } } | undefined>;
        };
        const value =
          typeof root === "string" ? elements?.[root]?.props?.title : undefined;
        if (typeof value === "string") title = value;
      }
    } catch {
      title = "";
    }
    if (!title || !m.text || m.text.includes("\n")) return false;
    const inTitle = new Set(words(title));
    const said = words(m.text);
    return said.length > 0 && said.every((word) => inTitle.has(word));
  });
  const author = (message: ChatMessage) => messageAuthor(message, vb);
  const day = (ts: number) =>
    new Date(ts).toDateString() === new Date().toDateString()
      ? vb.hhmm(ts)
      : `${new Date(ts).toLocaleDateString(vb.locale, { day: "numeric", month: "short" })} ${vb.hhmm(ts)}`;
</script>

{#snippet rich(text: string, mode: RichMode = "markdown")}<RichContent
    {text}
    {mode}
    {room}
    {actions}
    names={vb.knownNames}
    pageUrl={vb.pageUrl}
    fileLabel={vb.t("arquivo")}
    t={vb.t}
  />{/snippet}
<article
  id={origin ? undefined : `m${m.id}`}
  data-chat-message={m.id}
  data-message-kind={kind}
  data-continuous={continuous || undefined}
  data-fire-hot={fireHot}
  data-waiting={waiting}
  use:highlight
  use:swipeMessage={{
    enabled: !origin && !editing,
    reply: () => {
      if (active) actions.reply(m.id);
    },
    hold: () => {
      if (!active) return;
      showToolbar();
      void tick().then(() => {
        if (active) sheet = true;
      });
    },
  }}
  bind:this={article}
  onpointerenter={showToolbar}
  onfocusin={showToolbar}
  class={[
    continuous
      ? "group relative rounded-control px-3 pt-0.5 pb-0 font-sans text-[0.875rem] text-foreground transition-colors duration-150 pointer-fine:hover:bg-accent/55"
      : "group relative mt-1 rounded-control px-3 pt-1 pb-0 font-sans text-[0.875rem] text-foreground transition-colors duration-150 pointer-fine:hover:bg-accent/55",
    // A long press opens the actions sheet, so on a touch screen it does not also select text (the sheet copies).
    origin || editing
      ? ""
      : "pointer-coarse:select-none [-webkit-touch-callout:none]",
    waiting ? "border-l-2 border-warning bg-warning/10" : "",
    attention ? "animate-pulse motion-reduce:animate-none" : "",
    flash || sheet ? "bg-accent" : "",
    fireHot
      ? "after:pointer-events-none after:absolute after:inset-0 after:animate-pulse after:rounded-surface after:ring-2 after:ring-warning motion-reduce:after:animate-none"
      : "",
  ]}
>
  <!-- What letting go of a swipe does (Gui #2668): the reply icon comes out past the message's left edge as it slides,
       grows, and turns darker where letting go replies: gray, like WhatsApp (Gimenes #4533, #4549). The rest is in the sheet a long press
       opens (Gimenes #4440). -->
  <span
    aria-hidden="true"
    class="pointer-events-none absolute top-1/2 right-[calc(100%+8px)] grid size-8 -translate-y-1/2 scale-50 place-items-center rounded-full bg-muted text-muted-foreground opacity-0 transition-[opacity,scale,background-color,color] duration-150 ease-out in-data-[swipe=reply]:scale-100 in-data-[swipe=reply]:text-foreground in-data-[swipe=reply]:opacity-100 in-data-[swipe=tracking]:scale-75 in-data-[swipe=tracking]:opacity-70 motion-reduce:transition-none"
    ><Icon icon="reverse-left" size={16} /></span
  >
  {#if m.reply_to}<!-- The message it answers, one line above the header (like Discord): a spine from the avatar
       curls up into a small picture, the author and the start of their message; a click jumps there. -->
    <button
      type="button"
      data-quote={m.reply_to}
      title={vb.t("Ver a mensagem respondida")}
      class="group/quote relative mb-1 flex h-[22px] w-full min-w-0 cursor-pointer items-center gap-1 border-0 bg-transparent p-0 pl-14 text-left font-sans text-sm leading-[18px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onclick={() => {
        if (active)
          actions.navigate(m.reply_to!, quote?.thread ?? m.reply_thread);
      }}
    >
      <span
        aria-hidden="true"
        class="pointer-events-none absolute top-1/2 -bottom-1 left-[19px] w-[29px] rounded-tl-md border-t-2 border-l-2 border-solid border-r-0 border-b-0 border-muted-foreground/35"
      ></span>
      {#if quote}{#if quote.author === "ai"}<span
            aria-hidden="true"
            class="flex size-4 shrink-0 items-center justify-center text-[0.6875rem] select-none"
            >✦</span
          >{:else}<PersonAvatar
            size="2xs"
            email={quote.author}
            version={vb.avatarVersion(quote.author)}
            class="shrink-0"
          />{/if}<span
          class={[
            "shrink-0 font-medium",
            quote.kind === "agent"
              ? AGENT_NAMES[agentProvider(quote.via)]
              : "text-foreground/80",
          ]}>@{author(quote)}</span
        ><span class="min-w-0 truncate group-hover/quote:text-foreground"
          >{messageSnippet(quote, vb.t("votação"))}</span
        >{:else}<span class="truncate italic">{vb.t("mensagem anterior")}</span
        >{/if}
    </button>{/if}
  <!-- The row's shape is shared with the room's loading state (room-shell/shape.ts). -->
  <div class={MESSAGE_ROW}>
    <div data-message-avatar class={MESSAGE_AVATAR}>
      {#if !continuous}{#if m.author === "ai"}<AgentMark
            mark="✦"
            size="base"
            class="text-base"
          />{:else if m.kind === "agent"}<!-- As in the classic app: the agent's tile, with the person it speaks for in the corner. -->
          <PersonCard
            email={m.author}
            lang={vb.locale?.startsWith("en") ? "en" : "pt"}
            ><div class="relative size-10" title={author(m)}>
              <AgentMark
                via={m.via}
                tint
                size="base"
                class="text-lg"
              /><PersonAvatar
                size="xs"
                data-avatar="person"
                email={m.author}
                version={vb.avatarVersion(m.author)}
                class="absolute -right-1.5 -bottom-1.5 size-5 ring-2 ring-background"
              />
            </div></PersonCard
          >{:else}<PersonCard
            email={m.author}
            lang={vb.locale?.startsWith("en") ? "en" : "pt"}
            ><PersonAvatar
              size="base"
              data-avatar="person"
              email={m.author}
              version={vb.avatarVersion(m.author)}
            /></PersonCard
          >{/if}{:else}<time
          title={timestamp}
          class="-mx-3 block text-center text-xs leading-6 whitespace-nowrap text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          >{vb.hhmm(m.ts)}</time
        >{/if}
    </div>
    <div data-message-body class="min-w-0 flex-1 space-y-1">
      {#if !continuous}<div
          data-message-head
          class="-mb-0.5 flex min-h-5 flex-wrap items-center gap-x-2 text-xs text-muted-foreground"
        >
          <span
            class={[
              // The name is as big as the message under it; only the weight differs.
              "text-[0.875rem] leading-5 font-semibold",
              m.kind === "agent"
                ? AGENT_NAMES[agentProvider(m.via)]
                : "text-foreground",
            ]}>{author(m)}</span
          ><!-- No "agent" pill: the agent's name and color already say it (Gimenes #4264). -->{#if m.tag === "done"}<Badge
              size="sm"
              class="select-none"
              variant="success">{vb.t("entregue")}</Badge
            >{/if}<time title={timestamp}
            >{vb.hhmm(m.ts)}<span
              data-time-zone
              class="ml-1 text-[0.625rem] text-muted-foreground select-none"
              >{chatZone(m.ts)}</span
            ></time
          >
        </div>{/if}
      {#if kind === "regular"}
        {#if m.deleted}<p
            data-message-deleted
            class="m-0 text-muted-foreground italic"
          >
            {vb.t("Mensagem apagada")}
          </p>
        {:else if !m.text && (typing || (m.author === "ai" && !m.poll))}<p
            data-message-typing
            role="status"
            class="m-0 text-muted-foreground"
          >
            {typing
              ? vb.typingNote?.(m.id) ||
                vb.t("pensando ({mode})", {
                  mode: vb.typingLabel?.(typing) ?? typing,
                })
              : vb.t("pensando…")}{typing ? "…" : ""}
          </p>
        {:else if editing}<MessageEditor message={m} {actions} {vb} />
        {:else if m.text && !echoesCard}{@render rich(
            m.text,
            m.author === "ai" || m.kind === "agent" ? "markdown" : "human",
          )}{/if}{#if m.edited && !m.deleted && !editing}<span
            data-message-edited
            class="text-xs text-muted-foreground select-none"
            >{vb.t("(editada)")}</span
          >{/if}
        <Attachments
          roomId={room.id}
          messageThread={m.thread}
          files={m.files}
          {actions}
          {vb}
        />
        {#if m.card || m.choices || m.poll}<DeferredInteractiveBody
            message={m}
            {room}
            {actions}
            {vb}
          />{/if}
      {:else if kind === "reminder"}<details class="space-y-2">
          <summary
            class="cursor-pointer rounded-control leading-6 focus-visible:outline-2 focus-visible:outline-ring"
            ><span aria-hidden="true" class="select-none">⏰</span>
            {#if reminder.name}<b>{reminder.name}</b>
            {/if}{reminder.head} · {reminder.runs.length > 1
              ? `${vb.t("rodou {n}×", { n: reminder.runs.length })} · `
              : ""}<time title={timestamp}>{day(m.ts)}</time></summary
          >{#if reminder.body}{@render rich(
              reminder.body,
            )}{/if}{#if reminder.runs.length > 1}<p
              class="m-0 text-xs text-muted-foreground"
            >
              {reminder.runs.map(day).join(" · ")}
            </p>{/if}
        </details>
      {:else if kind === "issue"}<details class="space-y-3">
          <summary
            class="cursor-pointer rounded-control leading-6 focus-visible:outline-2 focus-visible:outline-ring"
            ><span aria-hidden="true" class="select-none">⚠</span>
            <b
              >{group.length > 1
                ? vb.t("{n} issues dos agents", { n: group.length })
                : vb.t("Issue de um agent")}</b
            >
            {issueParts(m).body.replace(/\s+/g, " ").slice(0, 140)} ·
            <time title={timestamp}>{day(m.ts)}</time></summary
          >{#each [...group].reverse() as issue (issue.id)}<div
              class="space-y-2 border-l-2 border-border pl-3"
            >
              <time class="text-xs text-muted-foreground">{day(issue.ts)}</time
              >{@render rich(issueParts(issue).head)}
              <p class="m-0 whitespace-pre-wrap break-words">
                {issueParts(issue).body}
              </p>
              <MessageActions
                message={issue}
                showLink={false}
                roomId={room.id}
                {actions}
                {vb}
              />
            </div>{/each}
        </details>
      {:else}<details class="space-y-2">
          <summary
            class="cursor-pointer rounded-control leading-6 focus-visible:outline-2 focus-visible:outline-ring"
            ><span aria-hidden="true" class="select-none">✦</span>
            {@render rich(
              m.text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim(),
              "inline",
            )} · <time title={timestamp}>{day(m.ts)}</time></summary
          >{@render rich(m.text)}
        </details>{/if}
      {#if threadError}<p
          role="alert"
          data-thread-error={m.id}
          class="m-0 mt-1 text-xs text-destructive"
        >
          {threadError}
        </p>{/if}
      {#if !origin && kind !== "issue" && kind !== "notice"}{#each kind === "reminder" ? group : [m] as source (source.id)}<ThreadCards
            {room}
            messageId={source.id}
            {actions}
            {vb}
          />{/each}{/if}
      <!-- One bar under the message (Gui #2761): reactions on the left, acks and seen on the right. A message people
           can react to always keeps it, 24px high, so the quick reactions that show there on hover (Gui #4726) move
           nothing; the message's own padding is tight to make up for it. It pulls up over the body's 4px gap, inside
           the message. Not selectable: copying a conversation takes the messages, not ✓ ⏳ ✻ and the reaction chips
           (Gimenes #3622). Not while the
           text is a box: its "esc / enter" line sits there. -->
      {#if !origin && !editing && (footer || reactable)}<div
          data-reaction-row={m.id}
          class={[
            "-mt-1 flex min-h-6 flex-wrap items-center justify-between gap-x-3 select-none",
            bare && "pointer-coarse:hidden",
          ]}
        >
          {#if reactable}<MessageReactions
              message={m}
              me={room.me}
              {actions}
              {vb}
            />{/if}
          {#if footer && !origin}<div class="ml-auto">
              <MessageFooter {footer} {vb} />
            </div>{/if}
        </div>{/if}
    </div>
  </div>
  {#if editing}<!-- No toolbar while the text is a box. -->{:else if toolbar}<MessageActions
      bind:this={actionController}
      bind:sheet
      floating
      canReact={!origin &&
        kind !== "issue" &&
        kind !== "notice" &&
        kind !== "reminder"}
      me={room.me}
      message={m}
      roomId={room.id}
      onthread={threadable ? () => void startThread() : undefined}
      canEdit={editable}
      canDelete={!m.deleted &&
        !startsThread(room, m) &&
        ((m.author === room.me && m.kind !== "agent") ||
          room.book.owner === room.me)}
      history={room.book.owner === room.me && (m.edited || m.deleted)
        ? (room.history?.[m.id] ?? null)
        : undefined}
      {actions}
      {vb}
    />{:else}<button
      type="button"
      data-message-toolbar-entry
      data-chat-hover-only
      class="sr-only pointer-coarse:hidden"
      aria-label={vb.t("Ações desta mensagem")}
      onfocus={enterToolbar}
      onclick={enterToolbar}
    ></button>{/if}
</article>
