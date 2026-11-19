<script lang="ts">
  import { onDestroy } from "svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import AgentMark from "../../lib/components/AgentMark.svelte";
  import Badge from "../../lib/studio/Badge.svelte";
  import { AGENT_NAMES, agentProvider } from "../../lib/components/agent";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import type { SearchResult } from "../../../shared/schemas";
  import { matchesQuery, roomSearchQuery } from "./roomSearch";
  /**
   * The room's message search, in the pane beside the chat (like Discord's): the messages this room has loaded
   * that match, newest first, then what the server finds further back. A click jumps to the message.
   */
  type Hit = {
    id: number;
    thread: string;
    author: string;
    ts: number;
    text: string;
    /** Written by the person's agent (kind "agent"), in their name. */
    kind?: string | null;
    via?: string | null;
  };
  let {
    roomId,
    messages,
    epicTitle,
    vb,
    search,
    onjump,
  }: {
    roomId: string;
    messages: readonly Hit[];
    epicTitle: (thread: string) => string | null;
    vb: {
      t: (text: string, vars?: Record<string, string | number>) => string;
      name: (email: string) => string;
      ago: (ts: number) => string;
      avatarVersion: (email: string) => number | null | undefined;
    };
    search: (q: string, signal: AbortSignal) => Promise<SearchResult>;
    onjump: (id: number, thread: string) => void;
  } = $props();
  const query = roomSearchQuery;
  let remote = $state<Hit[]>([]),
    loading = $state(false),
    timer: ReturnType<typeof setTimeout> | undefined,
    abort: AbortController | null = null;
  const local = $derived(
    [...messages]
      .filter((m) => m.text && matchesQuery(m.text, $query))
      .sort((a, b) => b.id - a.id),
  );
  const hits = $derived.by(() => {
    const seen = new Set(local.map((m) => m.id));
    return [...local, ...remote.filter((m) => !seen.has(m.id))].slice(0, 80);
  });
  $effect(() => {
    const q = $query.trim();
    clearTimeout(timer);
    abort?.abort();
    remote = [];
    if (q.length < 2) {
      loading = false;
      return;
    }
    loading = true;
    timer = setTimeout(() => {
      const controller = new AbortController();
      abort = controller;
      search(q, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          remote = result.messages
            .filter((m) => m.room_id === roomId)
            .map((m) => ({
              id: m.id,
              thread: m.thread,
              author: m.author,
              ts: m.ts,
              text: m.snippet,
              kind: m.by_agent ? "agent" : null,
              via: m.via,
            }));
        })
        .catch(() => {})
        .finally(() => {
          if (!controller.signal.aborted) loading = false;
        });
    }, 300);
  });
  onDestroy(() => {
    clearTimeout(timer);
    abort?.abort();
  });
  /** The query's words marked in a line of the message. */
  function parts(value: string, q: string) {
    const words = q.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [{ text: value, hit: false }];
    const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return value
      .split(new RegExp(`(${escaped.join("|")})`, "ig"))
      .filter(Boolean)
      .map((piece) => ({
        text: piece,
        hit: words.some((w) => w.toLowerCase() === piece.toLowerCase()),
      }));
  }
</script>

<section
  data-room-search
  aria-label={vb.t("Buscar nesta sala")}
  class="flex min-h-0 flex-1 flex-col font-sans text-sm text-foreground"
>
  <!-- The field is in the top bar; here only how many it found (like Discord's "N Results"). -->
  {#if $query.trim().length >= 2}<p
      role="status"
      class="m-0 flex shrink-0 items-center gap-2 px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground"
    >
      {vb.t(hits.length === 1 ? "1 resultado" : "{n} resultados", {
        n: hits.length,
      })}{#if loading}<Spinner size="xs" />{/if}
    </p>{/if}
  <ol
    class="m-0 flex min-h-0 flex-1 list-none flex-col gap-1 overflow-y-auto p-2"
  >
    {#each hits as hit (hit.id)}<li>
        <button
          type="button"
          data-search-hit={hit.id}
          class="flex w-full cursor-pointer gap-3 rounded-lg border-0 bg-transparent p-2.5 text-left font-sans text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          onclick={() => onjump(hit.id, hit.thread)}
          ><!-- Who wrote it, drawn as in the chat: @vibe's ✦, an agent's tile with its person in the corner, or the person. -->
          {#if hit.author === "ai"}<AgentMark
              mark="✦"
              size="sm"
              class="text-sm"
            />{:else if hit.kind === "agent"}<span
              class="relative size-8 shrink-0"
              ><AgentMark
                via={hit.via}
                tint
                size="sm"
                class="text-base"
              /><PersonAvatar
                size="2xs"
                email={hit.author}
                version={vb.avatarVersion(hit.author)}
                class="absolute -right-1 -bottom-1 size-4 ring-2 ring-background"
              /></span
            >{:else}<PersonAvatar
              email={hit.author}
              version={vb.avatarVersion(hit.author)}
              size="sm"
            />{/if}<span class="flex min-w-0 flex-1 flex-col gap-0.5"
            ><span class="flex min-w-0 items-center gap-2 text-xs"
              ><b
                class={[
                  "truncate text-sm font-semibold",
                  hit.kind === "agent" && AGENT_NAMES[agentProvider(hit.via)],
                ]}
                >{hit.author === "ai"
                  ? "@vibe"
                  : hit.kind === "agent"
                    ? vb.t("{via} de {who}", {
                        via: hit.via || "agent",
                        who: vb.name(hit.author),
                      })
                    : vb.name(hit.author)}</b
              >{#if hit.kind === "agent"}<Badge size="sm">agent</Badge
                >{/if}<span class="shrink-0 text-muted-foreground"
                >{vb.ago(hit.ts)}</span
              >{#if hit.thread !== "main" && epicTitle(hit.thread)}<span
                  class="min-w-0 truncate text-muted-foreground"
                  >› {epicTitle(hit.thread)}</span
                >{/if}</span
            ><span class="line-clamp-3 break-words leading-5"
              >{#each parts(hit.text, $query) as piece}{#if piece.hit}<mark
                    class="rounded-sm bg-brand/30 px-px text-inherit"
                    >{piece.text}</mark
                  >{:else}{piece.text}{/if}{/each}</span
            ></span
          ></button
        >
      </li>{/each}
    {#if $query.trim().length >= 2 && !loading && !hits.length}<li
        class="px-4 py-10 text-center text-muted-foreground"
      >
        {vb.t("Nada encontrado nesta sala")}
      </li>{/if}
  </ol>
</section>
