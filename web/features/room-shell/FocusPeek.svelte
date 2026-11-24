<script lang="ts">
  import type { ChatBridge, ChatProps } from "../../app/chatTypes";
  import { threadWorkers, prettyModel, messageAuthor } from "../chat/model";
  import { paneFocus } from "../room-layout/focus";
  /** In Expand, over the floating composer: what came back after you wrote, a reply or an agent at work, in one quiet line.
   * A click puts the chat back. Only what arrived since Expand opened; your own message shows as sent for 4s (Valls), until something comes back. */
  let {
    room,
    thread,
    list,
    me,
    vb,
  }: {
    room: ChatProps["room"];
    thread: string;
    list: ChatProps["list"];
    me: string;
    vb: Pick<ChatBridge, "t" | "name">;
  } = $props();
  const since = Date.now();
  let now = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 15_000);
    return () => clearInterval(timer);
  });
  const workers = $derived(threadWorkers(room, thread, now));
  const reply = $derived(
    list.filter((m) => m.ts > since && m.text.trim()).at(-1),
  );
  // Your own message: a 4s receipt, then the line goes (an agent or a reply brings it back).
  let seenSent = $state<number | null>(null);
  $effect(() => {
    const id = reply && reply.author === me ? reply.id : null;
    if (id === null) return;
    const timer = setTimeout(() => (seenSent = id), 4000);
    return () => clearTimeout(timer);
  });
  const line = $derived(
    workers.length
      ? {
          working: true,
          sent: false,
          who: workers
            .map((w) =>
              vb.t("{via} de {who}", {
                via: prettyModel(w.who),
                who: vb.name(w.email),
              }),
            )
            .join(", "),
          text: vb.t(
            workers.length === 1
              ? "está trabalhando nisso"
              : "estão trabalhando nisso",
          ),
        }
      : reply && !(reply.author === me && seenSent === reply.id)
        ? {
            working: false,
            sent: reply.author === me,
            who: reply.author === me ? vb.t("Você") : messageAuthor(reply, vb),
            text: reply.text.replace(/\s+/g, " ").trim(),
          }
        : null,
  );
</script>

{#if line}<button
    type="button"
    data-focus-peek
    class="pointer-events-auto flex max-w-[720px] min-w-0 cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-3.5 py-1.5 font-sans text-sm text-muted-foreground shadow-[0_2px_10px_-4px_rgb(0_0_0/0.12)] transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
    onclick={() => paneFocus.set(false)}
    >{#if line.working}<span
        aria-hidden="true"
        class="animate-spin text-agent-claude-text motion-reduce:animate-none"
        >✻</span
      >{/if}<span class="shrink-0 font-medium text-foreground">{line.who}</span
    ><span class="min-w-0 truncate">{line.text}</span>{#if line.sent}<span
        aria-hidden="true"
        class="shrink-0 text-xs">✓</span
      >{/if}</button
  >{/if}
