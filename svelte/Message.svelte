<script lang="ts">
  import PersonAvatar from "./lib/components/PersonAvatar.svelte";
  import { onDestroy } from "svelte";
  import DeferredInteractiveBody from "./features/chat-interactive/DeferredInteractiveBody.svelte";
  import RichContent from "./features/rich-text/RichContent.svelte";
  import type { RichMode } from "./features/rich-text/types";
  import type { Room } from "../shared/room";
  import type { ChatActions, ChatBridge, ChatMessage } from "./chatTypes";
  import {
    continues,
    issueParts,
    messageKind,
    messageSnippet,
    reminderParts,
    type MessageFooter as Footer,
  } from "./features/chat/model";
  import AgentMark from "./lib/components/AgentMark.svelte";
  import { AGENT_NAMES, agentProvider } from "./lib/components/agent";
  import Badge from "./lib/studio/Badge.svelte";
  import MessageActions from "./features/chat/MessageActions.svelte";
  import MessageFooter from "./features/chat/MessageFooter.svelte";
  import MessageReactions from "./features/chat/MessageReactions.svelte";
  import Attachments from "./features/chat/Attachments.svelte";
  import ThreadCards from "./features/room-sidebar/ThreadCards.svelte";
  import { swipeMessage } from "./features/chat/swipe";
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
  const author = (message: ChatMessage) =>
    message.author === "ai"
      ? "@vibe"
      : message.kind === "agent"
        ? vb.t("{via} de {who}", {
            via: message.via || "agent",
            who: vb.name(message.author),
          })
        : vb.name(message.author);
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
  />{/snippet}
<article
  id={origin ? undefined : `m${m.id}`}
  data-chat-message={m.id}
  data-message-kind={kind}
  data-fire-hot={fireHot}
  data-waiting={waiting}
  use:highlight
  data-vb-native
  use:swipeMessage={{
    enabled: !origin,
    reply: () => {
      if (active) actions.reply(m.id);
    },
    copy: () => {
      void actionController?.copy();
    },
  }}
  class={[
    continuous
      ? "group relative rounded-control px-3 py-0.5 font-sans text-[0.875rem] text-foreground transition-colors duration-150 pointer-fine:hover:bg-accent/55"
      : "group relative mt-3 rounded-control px-3 pt-1 pb-0.5 font-sans text-[0.875rem] text-foreground transition-colors duration-150 pointer-fine:hover:bg-accent/55",
    waiting ? "border-l-2 border-warning bg-warning/10" : "",
    attention ? "animate-pulse motion-reduce:animate-none" : "",
    flash ? "bg-accent" : "",
    fireHot
      ? "after:pointer-events-none after:absolute after:inset-0 after:animate-pulse after:rounded-surface after:ring-2 after:ring-warning motion-reduce:after:animate-none"
      : "",
  ]}
>
  {#if m.reply_to}<!-- The message it answers, one line above the header (like Discord): a spine from the avatar
       curls up into a small picture, the author and the start of their message; a click jumps there. -->
    <button
      type="button"
      data-native-quote={m.reply_to}
      title={vb.t("Ver a mensagem respondida")}
      class="group/quote relative mb-1 flex h-[22px] w-full min-w-0 cursor-pointer items-center gap-1 border-0 bg-transparent p-0 pl-14 text-left font-sans text-[0.8125rem] leading-[18px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onclick={() => {
        if (active) actions.navigate(m.reply_to!, quote?.thread);
      }}
    >
      <span
        aria-hidden="true"
        class="pointer-events-none absolute top-1/2 -bottom-1 left-[19px] w-[29px] rounded-tl-md border-t-2 border-l-2 border-solid border-r-0 border-b-0 border-muted-foreground/35"
      ></span>
      {#if quote}{#if quote.author === "ai"}<span
            aria-hidden="true"
            class="flex size-4 shrink-0 items-center justify-center text-[0.6875rem]"
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
  <div class="flex items-start gap-4">
    <div class="w-10 shrink-0">
      {#if !continuous}{#if m.author === "ai"}<AgentMark
            mark="✦"
            size="base"
            class="text-base"
          />{:else if m.kind === "agent"}<!-- As in the classic app: the agent's tile, with the person it speaks for in the corner. -->
          <div class="relative size-10" title={author(m)}>
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
          </div>{:else}<PersonAvatar
            size="base"
            data-avatar="person"
            email={m.author}
            version={vb.avatarVersion(m.author)}
          />{/if}{:else}<time
          title={timestamp}
          class="-mx-3 block text-center text-xs leading-6 whitespace-nowrap text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          >{vb.hhmm(m.ts)}</time
        >{/if}
    </div>
    <div data-message-body class="min-w-0 flex-1 space-y-1">
      {#if !continuous}<div
          class="-mb-0.5 flex h-5 flex-wrap items-center gap-2 text-xs text-muted-foreground"
        >
          <span
            class={[
              // The name is as big as the message under it; only the weight differs.
              "text-[0.875rem] leading-5 font-semibold",
              m.kind === "agent"
                ? AGENT_NAMES[agentProvider(m.via)]
                : "text-foreground",
            ]}>{author(m)}</span
          >{#if m.kind === "agent"}<Badge
              size="sm"
              title={vb.t("Escrito pelo agent dessa pessoa, em nome dela")}
              >agent</Badge
            >{/if}{#if m.tag === "done"}<Badge
              size="sm"
              class="text-foreground"
              variant="success">✓ {vb.t("entregue")}</Badge
            >{/if}<time title={timestamp}>{vb.hhmm(m.ts)}</time>
        </div>{/if}
      {#if kind === "regular"}
        {#if !m.text && (typing || (m.author === "ai" && !m.poll))}<p
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
        {:else if m.text && !echoesCard}{@render rich(
            m.text,
            m.author === "ai" || m.kind === "agent" ? "markdown" : "human",
          )}{/if}
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
            >⏰ {#if reminder.name}<b>{reminder.name}</b>
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
            >⚠ <b
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
            >✦ {@render rich(
              m.text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim(),
              "inline",
            )} · <time title={timestamp}>{day(m.ts)}</time></summary
          >{@render rich(m.text)}
        </details>{/if}
      {#if !origin && kind !== "issue" && kind !== "notice"}{#each kind === "reminder" ? group : [m] as source (source.id)}<ThreadCards
            {room}
            messageId={source.id}
            {actions}
            {vb}
          />{/each}{/if}
      <!-- One bar under the message (Gui #2761): reactions on the left, acks and seen on the right. Only when there
           is something in it: an empty bar spread a run of messages from the same person apart. -->
      {#if (footer && !origin) || (!origin && Object.values(m.reactions ?? {}).some((who) => who.length))}<div
          class="flex flex-wrap items-center justify-between gap-x-3"
        >
          {#if !origin && kind !== "issue" && kind !== "notice" && kind !== "reminder"}<MessageReactions
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
  <MessageActions
    bind:this={actionController}
    floating
    canReact={!origin &&
      kind !== "issue" &&
      kind !== "notice" &&
      kind !== "reminder"}
    me={room.me}
    message={m}
    roomId={room.id}
    {actions}
    {vb}
  />
</article>
